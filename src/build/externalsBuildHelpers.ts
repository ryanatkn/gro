import type {ImportMap} from 'esinstall';

import {EXTERNALS_BUILD_DIR, toBuildOutPath} from '../paths.js';
import type {BuilderState, BuildContext} from './builder.js';
import {gray} from '../utils/terminal.js';
import type {BuildConfig} from '../config/buildConfig.js';
import {outputFile, pathExists, readJson} from '../fs/node.js';

export interface ExternalsBuilderState {
	readonly buildStates: Map<BuildConfig, ExternalsBuildState>;
}

// extends `filer.state.externals`
// TODO remove any of this that possibly can be removed via refactoring
export interface ExternalsBuildState {
	importMap: ImportMap | undefined;
	specifiers: Set<string>;
	installing: DelayedPromise<void> | null;
	installingCb: (() => Promise<void>) | null;
	idleTimer: number;
	resetterInterval: NodeJS.Timeout | null;
}

export const EXTERNALS_SOURCE_ID = EXTERNALS_BUILD_DIR;
// store the externals builder state here on the builder context `state` object
export const EXTERNALS_BUILDER_STATE_KEY = EXTERNALS_SOURCE_ID;

// throws if it can't find it
export const getExternalsBuilderState = (state: BuilderState): ExternalsBuilderState => {
	const builderState = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builderState === undefined) {
		throw Error(`Expected builder state to exist: ${EXTERNALS_BUILDER_STATE_KEY}`);
	}
	return builderState;
};

// this throws if the state already exists
export const initExternalsBuilderState = (state: BuilderState): ExternalsBuilderState => {
	let builderState = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builderState !== undefined) throw Error('Builder state already initialized');
	builderState = {buildStates: new Map()};
	state[EXTERNALS_BUILDER_STATE_KEY] = builderState;
	return builderState;
};

// throws if it can't find it
export const getExternalsBuildState = (
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
export const initExternalsBuildState = (
	builderState: ExternalsBuilderState,
	buildConfig: BuildConfig,
): ExternalsBuildState => {
	let buildState = builderState.buildStates.get(buildConfig);
	if (buildState !== undefined) throw Error('Build state already initialized');
	buildState = {
		importMap: undefined,
		specifiers: new Set(),
		installing: null,
		installingCb: null,
		idleTimer: 0,
		resetterInterval: null,
	};
	builderState.buildStates.set(buildConfig, buildState);
	return buildState;
};

export const toSpecifiers = (importMap: ImportMap): Set<string> =>
	new Set(Object.keys(importMap.imports));

export const toImportMapPath = (dest: string): string => `${dest}/import-map.json`;

// Normally `esinstall` writes out the `import-map.json` file,
// but whenever files are deleted we update it without going through `esinstall`.
// TODO remove this? isn't being used anywhere anymore
export const updateImportMapOnDisk = async (
	importMap: ImportMap,
	buildConfig: BuildConfig,
	{dev, buildDir, log}: BuildContext,
): Promise<void> => {
	const dest = toBuildOutPath(dev, buildConfig.name, EXTERNALS_BUILD_DIR, buildDir);
	const importMapPath = toImportMapPath(dest);
	// TODO `outputJson`? hmm
	log.trace(`writing import map to ${gray(importMapPath)}`);
	await outputFile(importMapPath, JSON.stringify(importMap, null, 2));
};

export const loadImportMapFromDisk = async (dest: string): Promise<ImportMap | undefined> => {
	const importMapPath = toImportMapPath(dest);
	if (!(await pathExists(importMapPath))) return undefined;
	const importMap: ImportMap = await readJson(importMapPath);
	return importMap;
};

export interface ExternalsAliases {
	[key: string]: string;
}
export const DEFAULT_EXTERNALS_ALIASES: ExternalsAliases = {
	path: 'path-browserify',
};

export interface DelayedPromise<T> {
	promise: Promise<T>;
	reset(): void;
}

export const createDelayedPromise = <T>(
	cb: () => Promise<T>,
	duration: number,
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

// Externals are Node imports referenced in browser builds.
export const isExternalBuildId = (
	id: string,
	buildConfig: BuildConfig,
	ctx: BuildContext,
): boolean =>
	buildConfig.platform === 'browser'
		? id.startsWith(
				toBuildOutPath(ctx.dev, buildConfig.name, EXTERNALS_BUILD_DIR, ctx.buildDir) + '/',
		  )
		: false;
