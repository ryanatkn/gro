import {basename, dirname, join} from 'path';
import {install, InstallResult, ImportMap} from 'esinstall';
import {Plugin as RollupPlugin} from 'rollup';

import {Logger, SystemLogger} from '../utils/log.js';
import {JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Builder, BuilderState, BuildOptions, ExternalsBuildSource, TextBuild} from './builder.js';
import {cyan, gray} from '../colors/terminal.js';
import {loadContents} from './load.js';
import {groSveltePlugin} from '../project/rollup-plugin-gro-svelte.js';
import {createDefaultPreprocessor} from './svelteBuildHelpers.js';
import {createCssCache} from '../project/cssCache.js';
import {printBuildConfig} from '../config/buildConfig.js';

/*

TODO this currently uses esinstall in a hacky way, (tbh this file is nightmare of unknown behavior)
using timeouts and polling state on intervals and other garbo. see below for more.
it's maybe fine but might cause problems.
it causes unnecessary delays building externals tho.

the root of the problem is that esinstall doesn't like being thrown incessant instructions,
seems to prefer us to be incremental instead, which is fine,
but this isn't a great solution

*/

export interface Options {
	importMap: ImportMap | undefined;
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[externalsBuilder]')]);
	return {
		importMap: undefined,
		...omitUndefined(opts),
		log,
	};
};

type ExternalsBuilder = Builder<ExternalsBuildSource, TextBuild>;

const encoding = 'utf8';

export const createExternalsBuilder = (opts: InitialOptions = {}): ExternalsBuilder => {
	const {importMap: initialImportMap, log} = initOptions(opts);

	const build: ExternalsBuilder['build'] = async (
		source,
		buildConfig,
		buildOptions: BuildOptions,
	) => {
		const {
			buildRootDir,
			dev,
			externalsDirBasePath,
			sourceMap,
			target,
			state,
			buildingSourceFiles,
		} = buildOptions;
		// if (sourceMap) {
		// 	log.warn('Source maps are not yet supported by the externals builder.');
		// }
		if (!dev) {
			throw Error('The externals builder is currently not designed for production usage.');
		}
		if (source.encoding !== encoding) {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}

		const dest = buildRootDir + externalsDirBasePath;
		let id: string;

		log.info(`bundling externals ${printBuildConfig(buildConfig)}: ${gray(source.id)}`);

		// TODO add an external API for customizing the `install` params
		// TODO this is legacy stuff that we need to rethink when we handle CSS better
		const cssCache = createCssCache();
		// const addPlainCssBuild = cssCache.addCssBuild.bind(null, 'bundle.plain.css');
		const addSvelteCssBuild = cssCache.addCssBuild.bind(null, 'bundle.svelte.css');
		const plugins: RollupPlugin[] = [
			groSveltePlugin({
				dev,
				addCssBuild: addSvelteCssBuild,
				preprocessor: createDefaultPreprocessor(sourceMap, target),
				compileOptions: {},
			}),
		];

		let contents: string;
		let commonDependencyIds: string[] | null = null;
		try {
			console.log('intalling');
			const result = await installExternal(
				source.id,
				dest,
				getExternalsBuilderState(state, initialImportMap),
				plugins,
				buildingSourceFiles,
				log,
			);
			console.log('installed');
			// Since we're batching the external installation process,
			// and it can return a number of common files,
			// we need to add those common files as build files to exactly one of the built source files.
			// It doesn't matter which one, so we just always pick the first source file in the data.
			if (source.id === Object.keys(result.importMap.imports)[0]) {
				commonDependencyIds = Object.keys(result.stats.common).map((path) => join(dest, path));
			}
			id = join(dest, result.importMap.imports[source.id]);
			contents = await loadContents(encoding, id);
		} catch (err) {
			log.error(`Failed to bundle external module: ${source.id}`);
			throw err;
		}

		const builds: TextBuild[] = [
			{
				id,
				filename: basename(id),
				dir: dirname(id),
				extension: JS_EXTENSION,
				encoding,
				contents,
				sourceMapOf: null,
				buildConfig,
			},
			...(commonDependencyIds === null
				? []
				: await Promise.all(
						commonDependencyIds.map(
							async (commonDependencyId): Promise<TextBuild> => ({
								id: commonDependencyId,
								filename: basename(commonDependencyId),
								dir: dirname(commonDependencyId),
								extension: JS_EXTENSION,
								encoding,
								contents: await loadContents(encoding, commonDependencyId),
								sourceMapOf: null,
								buildConfig,
							}),
						),
				  )),
		];

		return {builds};
	};

	return {build};
};

// TODO this is really hacky - it's working,
// but it causes unnecessary delays building externals
const DELAYED_PROMISE_DURATION = 250; // this needs to be larger than `IDLE_CHECK_INTERVAL`
const IDLE_CHECK_INTERVAL = 100; // this needs to be smaller than `DELAYED_PROMISE_DURATION`
const IDLE_TIME_LIMIT = parseInt((process.env as any).GRO_IDLE_TIME_LIMIT, 10) || 20000; // TODO hacky failsafe, it'll time out after this long, which may be totally busted in some cases..
// TODO wait what's the relationship between those two? check for errors?

const installExternal = async (
	sourceId: string,
	dest: string,
	state: ExternalsBuilderState,
	plugins: RollupPlugin[],
	buildingSourceFiles: Set<string>,
	log: Logger,
): Promise<InstallResult> => {
	buildingSourceFiles.delete(sourceId); // externals are hacky like this, because they'd cause it to hang!
	if (state.installing === null) {
		state.installing = createDelayedPromise(async () => {
			log.info('installing externals', state.specifiers); // TODO should these be like, `state.findSpecifiers()`?
			const result = await installExternals(state.specifiers, dest, plugins);
			log.info('install result', result);
			state.importMap = result.importMap;
			return result;
		});
		state.idleTimer = 0;
		state.resetterInterval = setInterval(() => {
			state.idleTimer += IDLE_CHECK_INTERVAL; // this is not a precise time value
			if (state.idleTimer > IDLE_TIME_LIMIT) {
				log.error(`installing externals timed out. this is a bug .. somewhere: ${sourceId}`);
				clearInterval(state.resetterInterval!);
				state.resetterInterval = null;
				state.idleTimer = 0;
				return;
			}
			state.installing!.reset();
			if (buildingSourceFiles.size === 0) {
				setTimeout(() => {
					// check again in a moment just to be sure
					if (buildingSourceFiles.size === 0) {
						clearInterval(state.resetterInterval!);
						state.resetterInterval = null;
						state.idleTimer = 0;
					}
				}, IDLE_CHECK_INTERVAL / 3); // TODO would cause a bug if this ever fires after the next interval
			}
		}, IDLE_CHECK_INTERVAL);
	}
	if (state.specifiers.has(sourceId)) return state.installing.promise;
	state.specifiers.add(sourceId);
	state.installing.reset();
	return state.installing.promise;
};

const createDelayedPromise = <T>(
	cb: () => Promise<T>,
	duration = DELAYED_PROMISE_DURATION,
): DelayedPromise<T> => {
	let resolve: any, reject: any;
	const promise = new Promise<T>((rs, rj) => ((resolve = rs), (reject = rj)));
	let timeout: NodeJS.Timeout | null = null;
	const delayed: DelayedPromise<T> = {
		promise,
		reset() {
			if (timeout !== null) {
				clearTimeout(timeout);
				timeout = null;
			}
			startTimeout();
		},
	};
	const startTimeout = () => {
		if (timeout !== null) throw Error(`Expected timeout to be null`);
		timeout = setTimeout(async () => {
			cb().then(resolve, reject);
		}, duration);
	};
	startTimeout();
	return delayed;
};

interface DelayedPromise<T> {
	promise: Promise<T>;
	reset(): void;
}

const installExternals = async (
	specifiers: Set<string>,
	dest: string,
	plugins: RollupPlugin[],
): Promise<InstallResult> => install(Array.from(specifiers), {dest, rollup: {plugins}});

export interface ExternalsBuilderState {
	importMap: ImportMap | undefined;
	specifiers: Set<string>;
	installing: DelayedPromise<InstallResult> | null;
	idleTimer: number;
	resetterInterval: NodeJS.Timeout | null;
}

const EXTERNALS_BUILDER_STATE_KEY = 'externals';

const getExternalsBuilderState = (
	state: BuilderState,
	initialImportMap?: ImportMap | undefined,
): ExternalsBuilderState => {
	let s = state[EXTERNALS_BUILDER_STATE_KEY];
	if (s !== undefined) return s; // note `initialImportMap` may not match `state.importMap`
	s = {
		importMap: initialImportMap,
		specifiers: new Set(
			initialImportMap === undefined ? [] : Object.keys(initialImportMap.imports),
		),
		installing: null,
		idleTimer: 0,
		resetterInterval: null,
	};
	state[EXTERNALS_BUILDER_STATE_KEY] = s;
	return s;
};
