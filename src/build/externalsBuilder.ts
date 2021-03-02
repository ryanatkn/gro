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
import {createLock} from '../utils/lock.js';
import {COMMON_SOURCE_ID} from './buildFile.js';
import {wrap} from '../utils/async.js';
import {BuildableExternalsSourceFile} from './sourceFile.js';
import {
	createDelayedPromise,
	ExternalsBuildState,
	getExternalsBuilderState,
	getExternalsBuildState,
	initExternalsBuilderState,
	initExternalsBuildState,
	loadImportMapFromDisk,
	toSpecifiers,
	updateImportMapOnDisk,
} from './externalsBuildHelpers.js';

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
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[externalsBuilder]')]);
	return {
		basePath: EXTERNALS_BUILD_DIR,
		...omitUndefined(opts),
		log,
	};
};

type ExternalsBuilder = Builder<TextBuildSource, TextBuild>;

const encoding = 'utf8';

export const createExternalsBuilder = (opts: InitialOptions = {}): ExternalsBuilder => {
	const {basePath, log} = initOptions(opts);

	// TODO i dunno lol. this code is freakish
	const lock = createLock<string>();

	const build: ExternalsBuilder['build'] = async (
		source,
		buildConfig,
		{buildRootDir, dev, sourceMap, target, state, buildingSourceFiles},
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

		if (source.id === COMMON_SOURCE_ID) {
			await buildState.installing?.promise; // wait for any pending installation to finish
			const builds = buildState.commonBuilds;
			if (builds === null) {
				throw Error('Expected to find builds for common externals');
			}
			buildState.commonBuilds = null;
			const result: BuildResult<TextBuild> = {builds};
			return result;
		}

		return wrap(async (after) => {
			const obtained = lock.lock(source.id);
			if (obtained) log.trace('externals lock obtained', gray(source.id));
			after(() => {
				const released = lock.unlock(source.id);
				if (released) log.trace('externals lock released', gray(source.id));
			});
			const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildRootDir);

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
			try {
				const installResult = await installExternal(
					source.id,
					dest,
					buildConfig,
					buildState,
					plugins,
					buildingSourceFiles,
					log,
				);
				// `state.importMap` is now updated
				id = join(dest, installResult.importMap.imports[source.id]);
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
			];

			// TODO maybe we return "common" `Build`s here?
			// the idea being that the `Filer` can handle them
			// as a whole after each compile.
			// Remember we can change the `Filer` API however we want to special case externals! or other needs
			// functionality is first: model the data correctly and process it correctly.
			// refactoring is a lot easier, and it's never too late to refactor! it never gets intractably hard
			const result: BuildResult<TextBuild> = {builds};
			return result;
		});
	};

	const onRemove: ExternalsBuilder['onRemove'] = async (
		sourceFile: BuildableExternalsSourceFile,
		buildConfig: BuildConfig,
		ctx: BuildContext,
	): Promise<void> => {
		const builderState = getExternalsBuilderState(ctx.state);
		const buildState = getExternalsBuildState(builderState, buildConfig);
		buildState.specifiers.delete(sourceFile.id);
		// mutate `importMap` with the removed source file
		if (buildState.importMap !== undefined) {
			delete buildState.importMap.imports[sourceFile.id];
			await updateImportMapOnDisk(buildState.importMap, buildConfig, ctx);
		}
	};

	const init: ExternalsBuilder['init'] = async (
		{state, dev, buildRootDir}: BuildContext,
		buildConfigs: BuildConfig[],
	): Promise<void> => {
		// initialize the externals builder state, which is stored on the `BuildContext` (the filer)
		const builderState = initExternalsBuilderState(state);
		// mutate the build state with any available initial values
		await Promise.all(
			buildConfigs.map(async (buildConfig) => {
				if (buildConfig.platform !== 'browser') return;
				const buildState = initExternalsBuildState(builderState, buildConfig);
				const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildRootDir);
				const importMap = await loadImportMapFromDisk(dest);
				if (importMap !== undefined) {
					buildState.importMap = importMap;
					buildState.specifiers = toSpecifiers(importMap);
				}
			}),
		);
	};

	return {build, onRemove, init};
};

// TODO this is really hacky - it's working,
// but it causes unnecessary delays building externals
const IDLE_CHECK_INTERVAL = 200; // needs to be smaller than `IDLE_CHECK_DELAY`
const IDLE_CHECK_DELAY = 500; // needs to be larger than `IDLE_CHECK_INTERVAL`
const IDLE_TIME_LIMIT = parseInt((process.env as any).GRO_IDLE_TIME_LIMIT, 10) || 20000; // TODO hacky failsafe, it'll time out after this long, which may be totally busted in some cases..
// TODO wait what's the relationship between those two? check for errors?

const installExternal = async (
	sourceId: string,
	dest: string,
	buildConfig: BuildConfig,
	state: ExternalsBuildState,
	plugins: RollupPlugin[],
	buildingSourceFiles: Set<string>,
	log: Logger,
): Promise<InstallResult> => {
	buildingSourceFiles.delete(sourceId); // externals are hacky like this, because they'd cause it to hang!
	if (state.installing === null) {
		state.installing = createDelayedPromise(async () => {
			log.info('installing externals', state.specifiers);
			const result = await installExternals(state.specifiers, dest, plugins);
			log.info('install result', result);
			// `state.specifiers` is already updated
			// log.info('old import map result', state.importMap);
			state.importMap = result.importMap;
			state.installing = null;
			if (state.commonBuilds !== null) {
				log.error('unexpected commonBuilds'); // indicates a problem, but don't want to throw
			}
			state.commonBuilds = await loadCommonBuilds(result, dest, buildConfig);
			return result;
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

const loadCommonBuilds = async (
	installResult: InstallResult,
	dest: string,
	buildConfig: BuildConfig,
): Promise<TextBuild[] | null> => {
	const commonDependencyIds = Object.keys(installResult.stats.common).map((path) =>
		join(dest, path),
	);
	if (commonDependencyIds.length === 0) return null;
	// log.trace('building common dependencies', commonDependencyIds);
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
				common: true,
			}),
		),
	);
};

const installExternals = async (
	specifiers: Set<string>,
	dest: string,
	plugins: RollupPlugin[],
): Promise<InstallResult> => install(Array.from(specifiers), {dest, rollup: {plugins}});
