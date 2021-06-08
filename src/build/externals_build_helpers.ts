import type {ImportMap} from 'esinstall';

import {EXTERNALS_BUILD_DIRNAME, to_build_out_path} from '../paths.js';
import type {Builder_State, Build_Context} from './builder.js';
import type {Build_Config} from '../build/build_config.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface Externals_Builder_State {
	readonly build_states: Map<Build_Config, ExternalsBuildState>;
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

export const EXTERNALS_SOURCE_ID = EXTERNALS_BUILD_DIRNAME;
// store the externals builder state here on the builder context `state` object
export const EXTERNALS_BUILDER_STATE_KEY = EXTERNALS_SOURCE_ID;

// throws if it can't find it
export const get_externals_builder_state = (state: Builder_State): Externals_Builder_State => {
	const builderState = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builderState === undefined) {
		throw Error(`Expected builder state to exist: ${EXTERNALS_BUILDER_STATE_KEY}`);
	}
	return builderState;
};

// this throws if the state already exists
export const initExternals_Builder_State = (state: Builder_State): Externals_Builder_State => {
	let builderState = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builderState !== undefined) throw Error('Builder state already initialized');
	builderState = {build_states: new Map()};
	state[EXTERNALS_BUILDER_STATE_KEY] = builderState;
	return builderState;
};

// throws if it can't find it
export const get_externals_build_state = (
	builderState: Externals_Builder_State,
	build_config: Build_Config,
): ExternalsBuildState => {
	const build_state = builderState.build_states.get(build_config);
	if (build_state === undefined) {
		throw Error(`Expected build state to exist: ${build_config.name}`);
	}
	return build_state;
};

// this throws if the state already exists
export const initExternalsBuildState = (
	builderState: Externals_Builder_State,
	build_config: Build_Config,
): ExternalsBuildState => {
	let build_state = builderState.build_states.get(build_config);
	if (build_state !== undefined) throw Error('Build state already initialized');
	build_state = {
		importMap: undefined,
		specifiers: new Set(),
		installing: null,
		installingCb: null,
		idleTimer: 0,
		resetterInterval: null,
	};
	builderState.build_states.set(build_config, build_state);
	return build_state;
};

export const toSpecifiers = (importMap: ImportMap): Set<string> =>
	new Set(Object.keys(importMap.imports));

export const toImportMapPath = (dest: string): string => `${dest}/import-map.json`;

export const loadImportMapFromDisk = async (
	fs: Filesystem,
	dest: string,
): Promise<ImportMap | undefined> => {
	const importMapPath = toImportMapPath(dest);
	if (!(await fs.exists(importMapPath))) return undefined;
	const importMap: ImportMap = JSON.parse(await fs.read_file(importMapPath, 'utf8'));
	return importMap;
};

export interface Externals_Aliases {
	[key: string]: string;
}
export const DEFAULT_EXTERNALS_ALIASES: Externals_Aliases = {
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
export const is_external_build_id = (
	id: string,
	build_config: Build_Config,
	ctx: Build_Context,
): boolean =>
	build_config.platform === 'browser'
		? id.startsWith(
				to_build_out_path(ctx.dev, build_config.name, EXTERNALS_BUILD_DIRNAME, ctx.build_dir) + '/',
		  )
		: false;
