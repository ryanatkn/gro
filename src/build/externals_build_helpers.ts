import type {ImportMap} from 'esinstall';

import {EXTERNALS_BUILD_DIRNAME, to_build_out_path} from '../paths.js';
import type {Builder_State, Build_Context} from './builder.js';
import type {Build_Config} from '../build/build_config.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface Externals_Builder_State {
	readonly build_states: Map<Build_Config, Externals_Build_State>;
}

// extends `filer.state.externals`
// TODO remove any of this that possibly can be removed via refactoring
export interface Externals_Build_State {
	import_map: ImportMap | undefined;
	specifiers: Set<string>;
	installing: Delayed_Promise<void> | null;
	installing_cb: (() => Promise<void>) | null;
	idle_timer: number;
	resetter_interval: NodeJS.Timeout | null;
}

export const EXTERNALS_SOURCE_ID = EXTERNALS_BUILD_DIRNAME;
// store the externals builder state here on the builder context `state` object
export const EXTERNALS_BUILDER_STATE_KEY = EXTERNALS_SOURCE_ID;

// throws if it can't find it
export const get_externals_builder_state = (state: Builder_State): Externals_Builder_State => {
	const builder_state = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builder_state === undefined) {
		throw Error(`Expected builder state to exist: ${EXTERNALS_BUILDER_STATE_KEY}`);
	}
	return builder_state;
};

// this throws if the state already exists
export const init_externals_builder_state = (state: Builder_State): Externals_Builder_State => {
	let builder_state = state[EXTERNALS_BUILDER_STATE_KEY];
	if (builder_state !== undefined) throw Error('Builder state already initialized');
	builder_state = {build_states: new Map()};
	state[EXTERNALS_BUILDER_STATE_KEY] = builder_state;
	return builder_state;
};

// throws if it can't find it
export const get_externals_build_state = (
	builder_state: Externals_Builder_State,
	build_config: Build_Config,
): Externals_Build_State => {
	const build_state = builder_state.build_states.get(build_config);
	if (build_state === undefined) {
		throw Error(`Expected build state to exist: ${build_config.name}`);
	}
	return build_state;
};

// this throws if the state already exists
export const initExternals_Build_State = (
	builder_state: Externals_Builder_State,
	build_config: Build_Config,
): Externals_Build_State => {
	let build_state = builder_state.build_states.get(build_config);
	if (build_state !== undefined) throw Error('Build state already initialized');
	build_state = {
		import_map: undefined,
		specifiers: new Set(),
		installing: null,
		installing_cb: null,
		idle_timer: 0,
		resetter_interval: null,
	};
	builder_state.build_states.set(build_config, build_state);
	return build_state;
};

export const to_specifiers = (import_map: ImportMap): Set<string> =>
	new Set(Object.keys(import_map.imports));

export const to_import_map_path = (dest: string): string => `${dest}/import-map.json`;

export const load_import_map_from_disk = async (
	fs: Filesystem,
	dest: string,
): Promise<ImportMap | undefined> => {
	const import_map_path = to_import_map_path(dest);
	if (!(await fs.exists(import_map_path))) return undefined;
	const import_map: ImportMap = JSON.parse(await fs.read_file(import_map_path, 'utf8'));
	return import_map;
};

export interface Externals_Aliases {
	[key: string]: string;
}
export const DEFAULT_EXTERNALS_ALIASES: Externals_Aliases = {
	path: 'path-browserify',
};

// TODO extract to felt?
export interface Delayed_Promise<T> {
	promise: Promise<T>;
	reset(): void;
}

export const create_delayed_promise = <T>(
	cb: () => Promise<T>,
	duration: number,
): Delayed_Promise<T> => {
	let resolve: any, reject: any;
	const promise = new Promise<T>((rs, rj) => ((resolve = rs), (reject = rj)));
	let timeout: NodeJS.Timeout | null = null;
	const delayed: Delayed_Promise<T> = {
		promise,
		reset() {
			if (timeout !== null) {
				clearTimeout(timeout);
				timeout = null;
			}
			start_timeout();
		},
	};
	const start_timeout = () => {
		if (timeout !== null) throw Error(`Expected timeout to be null`);
		timeout = setTimeout(async () => {
			cb().then(resolve, reject);
		}, duration);
	};
	start_timeout();
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
