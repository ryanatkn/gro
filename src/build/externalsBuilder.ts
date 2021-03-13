import {basename, dirname, join} from 'path';
import {install, InstallResult} from 'esinstall';
import {Plugin as RollupPlugin} from 'rollup';

import {Logger, SystemLogger} from '../utils/log.js';
import {EXTERNALS_BUILD_DIR, JS_EXTENSION, toBuildOutPath} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import type {Builder, BuildResult, BuildContext, TextBuildSource, TextBuild} from './builder.js';
import {cyan, gray} from '../colors/terminal.js';
import {loadContents} from './load.js';
import {groSveltePlugin} from '../project/rollup-plugin-gro-svelte.js';
import {createDefaultPreprocessor} from './svelteBuildHelpers.js';
import {createCssCache} from '../project/cssCache.js';
import {BuildConfig, printBuildConfig} from '../config/buildConfig.js';
import {
	createDelayedPromise,
	DEFAULT_EXTERNALS_ALIASES,
	ExternalsAliasMap,
	ExternalsBuildState,
	getExternalsBuilderState,
	getExternalsBuildState,
	initExternalsBuilderState,
	initExternalsBuildState,
	loadImportMapFromDisk,
	toImportMapSpecifiers,
	toSpecifiers,
} from './externalsBuildHelpers.js';
import {EMPTY_ARRAY} from '../utils/array.js';

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
	basePath: string;
	alias: ExternalsAliasMap;
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[externalsBuilder]')]);
	return {
		basePath: EXTERNALS_BUILD_DIR,
		alias: DEFAULT_EXTERNALS_ALIASES,
		...omitUndefined(opts),
		log,
	};
};

type ExternalsBuilder = Builder<TextBuildSource, TextBuild>;

const encoding = 'utf8';

export const createExternalsBuilder = (opts: InitialOptions = {}): ExternalsBuilder => {
	const {basePath, alias, log} = initOptions(opts);

	const build: ExternalsBuilder['build'] = async (
		source,
		buildConfig,
		{buildDir, dev, sourceMap, target, state},
	) => {
		// if (sourceMap) {
		// 	log.warn('Source maps are not yet supported by the externals builder.');
		// }
		if (!dev) {
			throw Error('The externals builder is currently not designed for production usage.');
		}
		if (source.encoding !== encoding) {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}

		const builderState = getExternalsBuilderState(state);
		const buildState = getExternalsBuildState(builderState, buildConfig);

		const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildDir);

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

		let builds: TextBuild[];
		let installResult: InstallResult;
		try {
			log.info('installing externals', buildState.specifiers);
			installResult = await install(Array.from(buildState.specifiers), {
				dest,
				rollup: {plugins},
				polyfillNode: true, // needed for some libs - maybe make customizable?
				alias,
			});
			log.info('install result', installResult);
			// log.trace('previous import map', state.importMap); maybe diff?
			buildState.importMap = installResult.importMap;

			// TODO load all of the files in the import map
			builds = [
				...(await Promise.all(
					toImportMapSpecifiers(installResult.importMap, alias).map(
						async (specifier): Promise<TextBuild> => {
							const id = join(dest, installResult.importMap.imports[specifier]);
							return {
								id,
								filename: basename(id),
								dir: dirname(id),
								extension: JS_EXTENSION,
								encoding,
								contents: await loadContents(encoding, id),
								sourceMapOf: null,
								buildConfig,
							};
						},
					),
				)),
				...((await loadCommonBuilds(installResult, dest, buildConfig)) || EMPTY_ARRAY),
			];
		} catch (err) {
			log.error(`Failed to bundle external module: ${source.id}`);
			throw err;
		}

		const result: BuildResult<TextBuild> = {builds};
		return result;
	};

	const init: ExternalsBuilder['init'] = async (
		{state, dev, buildDir}: BuildContext,
		buildConfigs: BuildConfig[],
	): Promise<void> => {
		// initialize the externals builder state, which is stored on the `BuildContext` (the filer)
		const builderState = initExternalsBuilderState(state);
		// mutate the build state with any available initial values
		await Promise.all(
			buildConfigs.map(async (buildConfig) => {
				if (buildConfig.platform !== 'browser') return;
				const buildState = initExternalsBuildState(builderState, buildConfig);
				const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildDir);
				const importMap = await loadImportMapFromDisk(dest);
				if (importMap !== undefined) {
					buildState.importMap = importMap;
					buildState.specifiers = toSpecifiers(importMap);
				}
			}),
		);
	};

	return {build, init};
};

// TODO this is really hacky - it's working in the general case,
// but it causes unnecessary delays building externals
const IDLE_CHECK_INTERVAL = 200; // needs to be smaller than `IDLE_CHECK_DELAY`
const IDLE_CHECK_DELAY = 700; // needs to be larger than `IDLE_CHECK_INTERVAL`
const IDLE_TIME_LIMIT = parseInt((process.env as any).GRO_IDLE_TIME_LIMIT, 10) || 20000; // TODO hacky failsafe, it'll time out after this long, which may be totally busted in some cases..
// TODO wait what's the relationship between those two? check for errors?

// TODO this hackily guesses if the filer is idle enough to start installing externals
export const queueExternalsBuild = async (
	sourceId: string,
	state: ExternalsBuildState,
	buildingSourceFiles: Set<string>,
	log: Logger,
	cb: () => Promise<void>, // last cb wins!
): Promise<void> => {
	state.installingCb = cb;
	buildingSourceFiles.delete(sourceId); // externals are hacky like this, because they'd cause it to hang!
	if (state.installing === null) {
		state.installing = createDelayedPromise(async () => {
			state.installing = null; // TODO so.. putting this after `cb()` causes an error
			await state.installingCb!();
			state.installingCb = null;
		}, IDLE_CHECK_DELAY);
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
					// TODO make this more robust lol
					if (buildingSourceFiles.size === 0) {
						clearInterval(state.resetterInterval!);
						state.resetterInterval = null;
						state.idleTimer = 0;
					}
				}, IDLE_CHECK_INTERVAL / 3); // TODO would cause a bug if this ever fires after the next interval
			}
		}, IDLE_CHECK_INTERVAL);
	}
	state.installing.reset();
	return state.installing.promise;
};

const loadCommonBuilds = async (
	installResult: InstallResult,
	dest: string,
	buildConfig: BuildConfig,
): Promise<TextBuild[] | null> => {
	const commonDependencyIds = Object.keys(installResult.stats.common).map((path) =>
		join(dest, path),
	);
	if (commonDependencyIds.length === 0) return null;
	// log.trace('loading common dependencies', commonDependencyIds);
	return Promise.all(
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
	);
};
