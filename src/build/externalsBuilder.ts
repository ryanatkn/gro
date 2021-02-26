import {basename, dirname, join} from 'path';
import {install, InstallResult, ImportMap} from 'esinstall';
import {Plugin as RollupPlugin} from 'rollup';

import {Logger, SystemLogger} from '../utils/log.js';
import {EXTERNALS_BUILD_DIR, JS_EXTENSION, toBuildOutPath} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import type {
	Builder,
	BuilderState,
	BuildResult,
	BuildContext,
	TextBuildSource,
	TextBuild,
} from './builder.js';
import {cyan, gray} from '../colors/terminal.js';
import {loadContents} from './load.js';
import {groSveltePlugin} from '../project/rollup-plugin-gro-svelte.js';
import {createDefaultPreprocessor} from './svelteBuildHelpers.js';
import {createCssCache} from '../project/cssCache.js';
import {BuildConfig, printBuildConfig} from '../config/buildConfig.js';
import {createLock} from '../utils/lock.js';
import {outputFile, pathExists, readJson} from '../fs/nodeFs.js';
import {COMMON_SOURCE_ID} from './buildFile.js';
import {wrap} from '../utils/async.js';
import {BuildableExternalsSourceFile} from './sourceFile.js';
import {deepEqual} from '../utils/deepEqual.js';

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
	) =>
		wrap(async (after) => {
			lock.tryToObtain(source.id);
			after(() => lock.tryToRelease(source.id));

			if (source.id === COMMON_SOURCE_ID) {
				const buildState = getExternalsBuildState(getExternalsBuilderState(state), buildConfig);
				const builds = buildState.commonBuilds;
				if (builds === null) {
					throw Error('Expected builds to build common files');
				}
				buildState.commonBuilds = null;
				console.log('building commons source!!!', builds.length);
				const result: BuildResult<TextBuild> = {builds};
				return result;
			}

			// if (sourceMap) {
			// 	log.warn('Source maps are not yet supported by the externals builder.');
			// }
			if (!dev) {
				throw Error('The externals builder is currently not designed for production usage.');
			}
			if (source.encoding !== encoding) {
				throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
			}

			const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildRootDir);

			let id: string;

			log.info(`bundling externals ${printBuildConfig(buildConfig)}: ${gray(source.id)}`);

			const builderState = getExternalsBuilderState(state);
			const buildState = getExternalsBuildState(builderState, buildConfig);

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
				const installResult = await installExternal(
					source.id,
					dest,
					buildState,
					plugins,
					buildingSourceFiles,
					log,
				);
				// `state.importMap` is now updated

				// Since we're batching the external installation process,
				// and it can return a number of common files,
				// we need to add those common files as build files to exactly one of the built source files.
				// It doesn't matter which one, so we just always pick the first source file in the data.
				if (lock.has(source.id)) {
					log.trace('handling common dependencies with lock', gray(source.id));
					// TODO ok so what if we didn't return these here, instead put them on the `state`
					// that way the builder encapsulates this need
					// but maybe it needs to request that a source file gets built, somehow? (the "common" one)
					// is this a good use case for `dirty`? what's the API look like?
					commonDependencyIds = Object.keys(installResult.stats.common).map((path) =>
						join(dest, path),
					);
				}
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

			if (commonDependencyIds !== null) {
				if (!lock.has(source.id)) {
					throw Error(`Expected to have lock: ${source.id} - ${commonDependencyIds.length}`);
				}
				if (buildState.pendingCommonBuilds !== null) {
					log.error('Unexpected pendingCommongBuilds'); // would indicate a problem, but don't want to throw
				}
				try {
					buildState.pendingCommonBuilds = await Promise.all(
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
				} catch (err) {
					log.error(`Failed to build common builds: ${commonDependencyIds.join(' ')}`);
					throw err;
				}
			}

			// TODO maybe we return "common" `Build`s here?
			// the idea being that the `Filer` can handle them
			// as a whole after each compile.
			// Remember we can change the `Filer` API however we want to special case externals! or other needs
			// functionality is first: model the data correctly and process it correctly.
			// refactoring is a lot easier, and it's never too late to refactor! it never gets intractably hard
			const result: BuildResult<TextBuild> = {builds};
			return result;
		});

	// TODO problem is `importMap` is different for each build config! but only 1 on state.
	// TODO maybe refactor this into callbacks/events/plugins or something
	const onRemove: ExternalsBuilder['onRemove'] = async (
		sourceFile: BuildableExternalsSourceFile,
		buildConfig: BuildConfig,
		ctx: BuildContext,
	): Promise<void> => {
		debugger;
		// TODO ok wait this state should exist right?
		const builderState = getExternalsBuilderState(ctx.state);
		const buildState = getExternalsBuildState(builderState, buildConfig);
		// update importMap for externals
		// TODO or set to undefined? or treat as immutable? (maybe treat all keys of `BuilderState[key]` as immer-compatible data?)
		// delete installResult.stats?.direct[sourceFile.id];
		// delete installResult.stats?.common[sourceFile.id];
		if (buildState.importMap !== undefined) {
			delete buildState.importMap.imports[sourceFile.id];
			await updateImportMapOnDisk(buildState.importMap, buildConfig, ctx);
		} else {
			console.log('TODO wait should we lazy load stuff here?');
			console.log('TODO what about re-using normal machinery for build files for import-map.json?');
		}
	};

	const init: ExternalsBuilder['init'] = async (
		{state, dev, buildRootDir}: BuildContext,
		buildConfigs: BuildConfig[], // TODO should these be moved to the `BuildContext`?
	): Promise<void> => {
		// initialize the externals builder state, which is stored on the `BuildContext` (the filer)
		const builderState = initExternalsBuilderState(state);
		for (const buildConfig of buildConfigs) {
			// by skipping `init` for non-browser platforms,
			// trying to build for those platforms will throw an error, which is what we want
			if (buildConfig.platform !== 'browser') continue;
			const buildState = initExternalsBuildState(builderState, buildConfig);
			const dest = toBuildOutPath(dev, buildConfig.name, basePath, buildRootDir);
			console.log('initializing, buildConfig.name, dest', buildConfig.name, dest);
			const importMap = await loadImportMapFromDisk(dest);
			if (importMap !== undefined) {
				console.log('loaded importMap:', importMap);
				buildState.importMap = importMap;
				buildState.specifiers = toSpecifiers(importMap);
			}
		}
	};

	return {build, onRemove, init};
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
			log.info('old import map result', state.importMap);
			state.importMap = result.importMap;
			if (!deepEqual(state.specifiers, toSpecifiers(result.importMap))) {
				debugger;
				console.log('state.specifiers', state.specifiers);
				console.log(' toSpecifiers(result.importMap)', toSpecifiers(result.importMap));
				process.exit();
			}
			state.installing = null;
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
	readonly buildStates: Map<BuildConfig, ExternalsBuildState>;
}

// extends `filer.state.externals`
// TODO remove any of this that possibly can be removed via refactoring
interface ExternalsBuildState {
	importMap: ImportMap | undefined;
	specifiers: Set<string>;
	installing: DelayedPromise<InstallResult> | null;
	idleTimer: number;
	resetterInterval: NodeJS.Timeout | null;
	commonBuilds: TextBuild[] | null;
	pendingCommonBuilds: TextBuild[] | null;
}

// store the externals builder state here on the builder context `state` object
const EXTERNALS_BUILDER_STATE_KEY = 'externals';

// throws if it can't find it
const getExternalsBuilderState = (state: BuilderState): ExternalsBuilderState => {
	const builderState = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builderState === undefined) {
		throw Error(`Expected builder state to exist: ${EXTERNALS_BUILDER_STATE_KEY}`);
	}
	return builderState;
};

// this throws if the state already exists
const initExternalsBuilderState = (state: BuilderState): ExternalsBuilderState => {
	let builderState = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builderState !== undefined) throw Error('Builder state already initialized');
	builderState = {buildStates: new Map()};
	state[EXTERNALS_BUILDER_STATE_KEY] = builderState;
	return builderState;
};

// throws if it can't find it
const getExternalsBuildState = (
	builderState: ExternalsBuilderState,
	buildConfig: BuildConfig,
): ExternalsBuildState => {
	const buildState = builderState.buildStates.get(buildConfig);
	if (buildState === undefined) {
		throw Error(`Expected build state to exist: ${buildConfig.name}`);
	}
	return buildState;
};

// this throws if the state already exists
const initExternalsBuildState = (
	builderState: ExternalsBuilderState,
	buildConfig: BuildConfig,
): ExternalsBuildState => {
	let buildState = builderState.buildStates.get(buildConfig);
	if (buildState !== undefined) throw Error('Build state already initialized');
	buildState = {
		importMap: undefined,
		specifiers: new Set(),
		// installStats: undefined, // TODO get initial stats too? yes when/if needed
		// TODO this needs to be a map, or do we need it at all?
		installing: null,
		idleTimer: 0,
		resetterInterval: null,
		commonBuilds: null,
		pendingCommonBuilds: null,
	};
	builderState.buildStates.set(buildConfig, buildState);
	return buildState;
};

const toSpecifiers = (importMap: ImportMap): Set<string> => new Set(Object.keys(importMap.imports));

const toImportMapPath = (dest: string): string => `${dest}/import-map.json`;

// Normally `esinstall` writes out the `import-map.json` file,
// but whenever files are deleted we update it without going through `esinstall`.
const updateImportMapOnDisk = async (
	importMap: ImportMap,
	buildConfig: BuildConfig,
	{dev, buildRootDir, log}: BuildContext,
): Promise<void> => {
	const dest = toBuildOutPath(dev, buildConfig.name, EXTERNALS_BUILD_DIR, buildRootDir);
	const importMapPath = toImportMapPath(dest);
	// TODO `outputJson`? hmm
	log.trace(`writing import map to ${gray(importMapPath)}`);
	await outputFile(importMapPath, JSON.stringify(importMap, null, 2));
};

const loadImportMapFromDisk = async (dest: string): Promise<ImportMap | undefined> => {
	const importMapPath = toImportMapPath(dest);
	if (!(await pathExists(importMapPath))) return undefined;
	const importMap: ImportMap = await readJson(importMapPath);
	return importMap;
};
