import {join, resolve} from 'node:path';
import {existsSync} from 'node:fs';

import {GRO_DIST_DIR, IS_THIS_GRO, paths} from './paths.js';
import {
	GRO_CONFIG_PATH,
	JS_CLI_DEFAULT,
	NODE_MODULES_DIRNAME,
	PM_CLI_DEFAULT,
	SERVER_DIST_PATH,
	SVELTEKIT_BUILD_DIRNAME,
	SVELTEKIT_DIST_DIRNAME,
} from './constants.js';
import create_default_config from './gro.config.default.js';
import type {Create_Config_Plugins} from './plugin.js';
import type {Map_Package_Json} from './package_json.js';
import type {Path_Filter, Path_Id} from './path.js';

/**
 * The config that users can extend via `gro.config.ts`.
 * This is exposed to users in places like tasks and genfiles.
 * @see https://github.com/ryanatkn/gro/blob/main/src/docs/config.md
 */
export interface Gro_Config {
	/**
	 * @see https://github.com/ryanatkn/gro/blob/main/src/docs/plugin.md
	 */
	plugins: Create_Config_Plugins;
	/**
	 * Maps the project's `package.json` before writing it to the filesystem.
	 * The `package_json` argument may be mutated, but the return value is what's used by the caller.
	 * Returning `null` is a no-op for the caller.
	 */
	map_package_json: Map_Package_Json | null;
	/**
	 * The root directories to search for tasks given implicit relative input paths.
	 * Defaults to `./src/lib`, then the cwd, then the Gro package dist.
	 */
	task_root_dirs: Path_Id[];
	/**
	 * When searching the filsystem for tasks and genfiles,
	 * directories and files are included if they pass all of these filters.
	 */
	search_filters: Path_Filter[];
	/**
	 * The CLI to use that's compatible with `node`.
	 */
	js_cli: string;
	/**
	 * The CLI to use that's compatible with `npm install` and `npm link`. Defaults to `'npm'`.
	 */
	pm_cli: string;
}

/**
 * The relaxed variant of `Gro_Config` that users can provide via `gro.config.ts`.
 * Superset of `Gro_Config`.
 * @see https://github.com/ryanatkn/gro/blob/main/src/docs/config.md
 */
export interface Raw_Gro_Config {
	plugins?: Create_Config_Plugins;
	map_package_json?: Map_Package_Json | null;
	task_root_dirs?: string[];
	search_filters?: Path_Filter | Path_Filter[] | null;
	js_cli?: string;
	pm_cli?: string;
}

export type Create_Gro_Config = (
	base_config: Gro_Config,
) => Raw_Gro_Config | Promise<Raw_Gro_Config>;

export const create_empty_gro_config = (): Gro_Config => ({
	plugins: () => [],
	map_package_json: default_map_package_json,
	task_root_dirs: [
		// TODO maybe disable if no SvelteKit `lib` directory? or other detection to improve defaults
		paths.lib,
		IS_THIS_GRO ? null : paths.root,
		IS_THIS_GRO ? null : GRO_DIST_DIR,
	].filter((v) => v !== null),
	search_filters: [(id) => !SEARCH_EXCLUDER_DEFAULT.test(id)],
	js_cli: JS_CLI_DEFAULT,
	pm_cli: PM_CLI_DEFAULT,
});

/**
 * The regexp used by default to exclude directories and files
 * when searching the filesystem for tasks and genfiles.
 * Customize via `search_filters` in the `Gro_Config`.
 * See the test cases for the exact behavior.
 */
export const SEARCH_EXCLUDER_DEFAULT = new RegExp(
	`(${
		'(^|/)\\.[^/]+' + // exclude all `.`-prefixed directories
		// TODO probably change to `pkg.name` instead of this catch-all (also `gro` below)
		`|(^|/)${NODE_MODULES_DIRNAME}(?!/(@[^/]+/)?gro/${SVELTEKIT_DIST_DIRNAME})` + // exclude `node_modules` unless it's to the Gro directory
		`|(^|/)${SVELTEKIT_BUILD_DIRNAME}` + // exclude the SvelteKit build directory
		`|(^|/)(?<!(^|/)gro/)${SVELTEKIT_DIST_DIRNAME}` + // exclude the SvelteKit dist directory unless it's in the Gro directory
		`|(^|/)${SERVER_DIST_PATH}` // exclude the Gro server plugin dist directory
	})($|/)`,
	'u',
);

const default_map_package_json: Map_Package_Json = (package_json) => {
	if (package_json.exports) {
		package_json.exports = Object.fromEntries(
			Object.entries(package_json.exports).filter(([k]) => !EXPORTS_EXCLUDER_DEFAULT.test(k)),
		);
	}
	return package_json;
};

export const EXPORTS_EXCLUDER_DEFAULT = /(\.md|\.(test|ignore)\.|\/(test|fixtures|ignore)\/)/;

/**
 * Transforms a `Raw_Gro_Config` to the more strict `Gro_Config`.
 * This allows users to provide a more relaxed config.
 */
export const normalize_gro_config = (raw_config: Raw_Gro_Config): Gro_Config => {
	const empty_config = create_empty_gro_config();
	// All of the raw config properties are optional,
	// so fall back to the empty values when `undefined`.
	const {
		plugins = empty_config.plugins,
		map_package_json = empty_config.map_package_json,
		task_root_dirs = empty_config.task_root_dirs,
		search_filters = empty_config.search_filters,
		js_cli = empty_config.js_cli,
		pm_cli = empty_config.pm_cli,
	} = raw_config;
	return {
		plugins,
		map_package_json,
		task_root_dirs: task_root_dirs.map((p) => resolve(p)),
		search_filters: Array.isArray(search_filters)
			? search_filters
			: search_filters
				? [search_filters]
				: [],
		js_cli,
		pm_cli,
	};
};

export interface Gro_Config_Module {
	readonly default: Raw_Gro_Config | Create_Gro_Config;
}

export const load_gro_config = async (dir = paths.root): Promise<Gro_Config> => {
	const default_config = normalize_gro_config(
		await create_default_config(create_empty_gro_config()),
	);
	const config_path = join(dir, GRO_CONFIG_PATH);
	if (!existsSync(config_path)) {
		// No user config file found, so return the default.
		return default_config;
	}
	// Import the user's `gro.config.ts`.
	const config_module = await import(config_path);
	validate_gro_config_module(config_module, config_path);
	return normalize_gro_config(
		typeof config_module.default === 'function'
			? await config_module.default(default_config)
			: config_module.default,
	);
};

export const validate_gro_config_module: (
	config_module: any,
	config_path: string,
) => asserts config_module is Gro_Config_Module = (config_module, config_path) => {
	const config = config_module.default;
	if (!config) {
		throw Error(`Invalid Gro config module at ${config_path}: expected a default export`);
	} else if (!(typeof config === 'function' || typeof config === 'object')) {
		throw Error(
			`Invalid Gro config module at ${config_path}: the default export must be a function or object`,
		);
	}
};
