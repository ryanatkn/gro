import {basename, dirname, join} from 'path';
import {install as installWithEsinstall} from 'esinstall';
import type {InstallResult} from 'esinstall';
import type {Plugin as RollupPlugin} from 'rollup';
import {print_log_label, System_Logger} from '@feltcoop/felt/utils/log.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {omitUndefined} from '@feltcoop/felt/utils/object.js';
import {cyan, gray} from '@feltcoop/felt/utils/terminal.js';
import {EMPTY_ARRAY} from '@feltcoop/felt/utils/array.js';
import {toEnvNumber} from '@feltcoop/felt/utils/env.js';

import {EXTERNALS_BUILD_DIRNAME, JS_EXTENSION, to_build_out_path} from '../paths.js';
import type {Builder, BuildResult, BuildContext, TextBuildSource, TextBuild} from './builder.js';
import {loadContents} from './load.js';
import {groSveltePlugin} from './rollup-plugin-gro-svelte.js';
import {createDefaultPreprocessor} from './svelteBuildHelpers.js';
import {createCssCache} from './cssCache.js';
import {print_build_config} from '../build/build_config.js';
import type {Build_Config} from '../build/build_config.js';
import {
	createDelayedPromise,
	getExternalsBuilderState,
	getExternalsBuildState,
	initExternalsBuilderState,
	initExternalsBuildState,
	loadImportMapFromDisk,
	toSpecifiers,
} from './externalsBuildHelpers.js';
import type {ExternalsBuildState} from './externalsBuildHelpers.js';
import type {Filesystem} from '../fs/filesystem.js';

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
	install: typeof installWithEsinstall;
	base_path: string;
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new System_Logger(print_log_label('externalsBuilder', cyan));
	return {
		install: installWithEsinstall,
		base_path: EXTERNALS_BUILD_DIRNAME,
		...omitUndefined(opts),
		log,
	};
};

type ExternalsBuilder = Builder<TextBuildSource, TextBuild>;

const encoding = 'utf8';

export const createExternalsBuilder = (opts: InitialOptions = {}): ExternalsBuilder => {
	const {install, base_path, log} = initOptions(opts);

	const build: ExternalsBuilder['build'] = async (
		source,
		build_config,
		{fs, build_dir, dev, sourcemap, target, state, externalsAliases},
	) => {
		// if (sourcemap) {
		// 	log.warn('Source maps are not yet supported by the externals builder.');
		// }
		if (source.encoding !== encoding) {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}

		const builderState = getExternalsBuilderState(state);
		const buildState = getExternalsBuildState(builderState, build_config);

		const dest = to_build_out_path(dev, build_config.name, base_path, build_dir);

		log.info(`bundling externals ${print_build_config(build_config)}: ${gray(source.id)}`);

		// TODO this is legacy stuff that we need to rethink when we handle CSS better
		const cssCache = createCssCache();
		// const addPlainCssBuild = cssCache.addCssBuild.bind(null, 'bundle.plain.css');
		const addSvelteCssBuild = cssCache.addCssBuild.bind(null, 'bundle.svelte.css');
		const plugins: RollupPlugin[] = [
			groSveltePlugin({
				dev,
				addCssBuild: addSvelteCssBuild,
				preprocessor: createDefaultPreprocessor(target, dev, sourcemap),
				compileOptions: {},
			}),
		];

		let builds: TextBuild[];
		let installResult: InstallResult;
		try {
			log.info('installing externals', buildState.specifiers);
			installResult = await install(Array.from(buildState.specifiers), {
				dest,
				rollup: {plugins} as any, // TODO type problem with esinstall and rollup
				polyfillNode: true, // needed for some libs - maybe make customizable?
				alias: externalsAliases,
			});
			log.info('install result', installResult);
			// log.trace('previous import map', state.importMap); maybe diff?
			buildState.importMap = installResult.importMap;
			builds = [
				...(await Promise.all(
					Array.from(buildState.specifiers).map(
						async (specifier): Promise<TextBuild> => {
							const id = join(dest, installResult.importMap.imports[specifier]);
							return {
								id,
								filename: basename(id),
								dir: dirname(id),
								extension: JS_EXTENSION,
								encoding,
								contents: await loadContents(fs, encoding, id),
								build_config,
							};
						},
					),
				)),
				...((await loadCommonBuilds(fs, installResult, dest, build_config)) || EMPTY_ARRAY),
			];
		} catch (err) {
			log.error(`Failed to bundle external module: ${source.id}`);
			throw err;
		}

		const result: BuildResult<TextBuild> = {builds};
		return result;
	};

	const init: ExternalsBuilder['init'] = async ({
		fs,
		state,
		dev,
		build_configs,
		build_dir,
	}: BuildContext): Promise<void> => {
		// initialize the externals builder state, which is stored on the `BuildContext` (the filer)
		const builderState = initExternalsBuilderState(state);
		// mutate the build state with any available initial values
		await Promise.all(
			build_configs!.map(async (build_config) => {
				if (build_config.platform !== 'browser') return;
				const buildState = initExternalsBuildState(builderState, build_config);
				const dest = to_build_out_path(dev, build_config.name, base_path, build_dir);
				const importMap = await loadImportMapFromDisk(fs, dest);
				if (importMap !== undefined) {
					buildState.importMap = importMap;
					buildState.specifiers = toSpecifiers(importMap);
				}
			}),
		);
	};

	return {name: '@feltcoop/gro-builder-externals', build, init};
};

// TODO this is really hacky - it's working in the general case,
// but it causes unnecessary delays building externals
const IDLE_CHECK_INTERVAL = 200; // needs to be smaller than `IDLE_CHECK_DELAY`
const IDLE_CHECK_DELAY = 700; // needs to be larger than `IDLE_CHECK_INTERVAL`
const IDLE_TIME_LIMIT = toEnvNumber('GRO_IDLE_TIME_LIMIT', 20_000); // TODO hacky failsafe, it'll time out after this long, which may be totally busted in some cases..
// TODO wait what's the relationship between those two? check for errors?

// TODO this hackily guesses if the filer is idle enough to start installing externals
export const queueExternalsBuild = async (
	source_id: string,
	state: ExternalsBuildState,
	buildingSourceFiles: Set<string>,
	log: Logger,
	cb: () => Promise<void>, // last cb wins!
): Promise<void> => {
	state.installingCb = cb;
	buildingSourceFiles.delete(source_id); // externals are hacky like this, because they'd cause it to hang!
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
				log.error(`installing externals timed out. this is a bug .. somewhere: ${source_id}`);
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
	fs: Filesystem,
	installResult: InstallResult,
	dest: string,
	build_config: Build_Config,
): Promise<TextBuild[] | null> => {
	const commonDependencyIds = Object.keys(installResult.stats.common).map((path) =>
		join(dest, path),
	);
	if (!commonDependencyIds.length) return null;
	// log.trace('loading common dependencies', commonDependencyIds);
	return Promise.all(
		commonDependencyIds.map(
			async (commonDependencyId): Promise<TextBuild> => ({
				id: commonDependencyId,
				filename: basename(commonDependencyId),
				dir: dirname(commonDependencyId),
				extension: JS_EXTENSION,
				encoding,
				contents: await loadContents(fs, encoding, commonDependencyId),
				build_config,
			}),
		),
	);
};
