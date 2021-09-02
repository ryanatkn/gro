import {basename, dirname, join} from 'path';
import {install as installWithEsinstall} from 'esinstall';
import type {InstallResult} from 'esinstall';
import type {Plugin as RollupPlugin} from 'rollup';
import {printLogLabel, SystemLogger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {cyan, gray} from '@feltcoop/felt/util/terminal.js';
import {EMPTY_ARRAY} from '@feltcoop/felt/util/array.js';
import {toEnvNumber} from '@feltcoop/felt/util/env.js';

import {EXTERNALS_BUILD_DIRNAME, JS_EXTENSION, toBuildOutPath} from '../paths.js';
import type {Builder, BuildContext, TextBuildSource} from 'src/build/builder.js';
import {loadContent} from './load.js';
import {rollupPluginGroSvelte} from './rollupPluginGroSvelte.js';
import {createDefaultPreprocessor} from './groBuilderSvelteUtils.js';
import {createCssCache} from './cssCache.js';
import {printBuildConfig} from '../build/buildConfig.js';
import type {BuildConfig} from 'src/build/buildConfig.js';
import {
	createDelayedPromise,
	getExternalsBuilderState,
	getExternalsBuildState,
	initExternalsBuilderState,
	initExternalsBuildState,
	loadImportMapFromDisk,
	toSpecifiers,
	EXTERNALS_SOURCE_ID,
} from './groBuilderExternalsUtils.js';
import type {ExternalsBuildState} from 'src/build/groBuilderExternalsUtils.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import type {BuildFile} from 'src/build/buildFile.js';
import {postprocess} from './postprocess.js';

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
	install?: typeof installWithEsinstall;
	basePath?: string;
	log?: Logger;
}

type ExternalsBuilder = Builder<TextBuildSource>;

const encoding = 'utf8';

export const groBuilderExternals = (options: Options = {}): ExternalsBuilder => {
	const {
		install = installWithEsinstall,
		basePath = EXTERNALS_BUILD_DIRNAME,
		log = new SystemLogger(printLogLabel('externalsBuilder', cyan)),
	} = options;

	const build: ExternalsBuilder['build'] = async (source, buildConfig, ctx) => {
		const {fs, buildDir, dev, sourcemap, target, state, externalsAliases} = ctx;

		// if (sourcemap) {
		// 	log.warn('Source maps are not yet supported by the externals builder.');
		// }
		if (source.encoding !== encoding) {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}

		const builderState = getExternalsBuilderState(state);
		const buildState = getExternalsBuildState(builderState, buildConfig);

		const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildDir);

		log.info(`bundling externals ${printBuildConfig(buildConfig)}: ${gray(source.id)}`);

		// TODO this is legacy stuff that we need to rethink when we handle CSS better
		const cssCache = createCssCache();
		// const addPlainCssBuild = cssCache.addCssBuild.bind(null, 'bundle.plain.css');
		const addSvelteCssBuild = cssCache.addCssBuild.bind(null, 'bundle.svelte.css');
		const plugins: RollupPlugin[] = [
			rollupPluginGroSvelte({
				dev,
				addCssBuild: addSvelteCssBuild,
				preprocessor: createDefaultPreprocessor(dev, target, sourcemap),
				compileOptions: {},
			}),
		];

		let buildFiles: BuildFile[];
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
			buildFiles = [
				...(await Promise.all(
					Array.from(buildState.specifiers).map(async (specifier): Promise<BuildFile> => {
						const id = join(dest, installResult.importMap.imports[specifier]);
						return {
							type: 'build',
							sourceId: source.id,
							buildConfig,
							dependencies: null,
							id,
							filename: basename(id),
							dir: dirname(id),
							extension: JS_EXTENSION,
							encoding,
							content: await loadContent(fs, encoding, id),
							contentBuffer: undefined,
							contentHash: undefined,
							stats: undefined,
							mimeType: undefined,
						};
					}),
				)),
				...((await loadCommonBuilds(fs, installResult, dest, buildConfig)) || EMPTY_ARRAY),
			];
		} catch (err) {
			log.error(`Failed to bundle external module: ${source.id}`);
			throw err;
		}

		await Promise.all(
			buildFiles.map((buildFile) => postprocess(buildFile, ctx, buildFiles, source)),
		);
		return buildFiles;
	};

	const init: ExternalsBuilder['init'] = async ({
		fs,
		state,
		dev,
		buildConfigs,
		buildDir,
	}: BuildContext): Promise<void> => {
		// initialize the externals builder state, which is stored on the `BuildContext` (the filer)
		const builderState = initExternalsBuilderState(state);
		// mutate the build state with any available initial values
		await Promise.all(
			buildConfigs!.map(async (buildConfig) => {
				if (buildConfig.platform !== 'browser') return;
				const buildState = initExternalsBuildState(builderState, buildConfig);
				const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildDir);
				const importMap = await loadImportMapFromDisk(fs, dest);
				if (importMap !== undefined) {
					buildState.importMap = importMap;
					buildState.specifiers = toSpecifiers(importMap);
				}
			}),
		);
	};

	return {name: '@feltcoop/groBuilderExternals', build, init};
};

// TODO this is really hacky - it's working in the general case,
// but it causes unnecessary delays building externals
const IDLE_CHECK_INTERVAL = 200; // needs to be smaller than `IDLE_CHECK_DELAY`
const IDLE_CHECK_DELAY = 700; // needs to be larger than `IDLE_CHECK_INTERVAL`
const IDLE_TIME_LIMIT = toEnvNumber('GRO_IDLE_TIME_LIMIT', 20_000); // TODO hacky failsafe, it'll time out after this long, which may be totally busted in some cases..
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
	fs: Filesystem,
	installResult: InstallResult,
	dest: string,
	buildConfig: BuildConfig,
): Promise<BuildFile[] | null> => {
	const commonDependencyIds = Object.keys(installResult.stats.common).map((path) =>
		join(dest, path),
	);
	if (!commonDependencyIds.length) return null;
	// log.trace('loading common dependencies', commonDependencyIds);
	return Promise.all(
		commonDependencyIds.map(async (commonDependencyId): Promise<BuildFile> => {
			return {
				type: 'build',
				sourceId: EXTERNALS_SOURCE_ID,
				buildConfig,
				dependencies: null,
				id: commonDependencyId,
				filename: basename(commonDependencyId),
				dir: dirname(commonDependencyId),
				extension: JS_EXTENSION,
				encoding,
				content: await loadContent(fs, encoding, commonDependencyId),
				contentBuffer: undefined,
				contentHash: undefined,
				stats: undefined,
				mimeType: undefined,
			};
		}),
	);
};
