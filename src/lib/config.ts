import {join, resolve} from 'node:path';

import {GRO_DIST_DIR, IS_THIS_GRO, paths} from './paths.js';
import {GRO_CONFIG_PATH} from './path_constants.js';
import create_default_config from './gro.config.default.js';
import type {Create_Config_Plugins} from './plugin.js';
import {exists} from './fs.js';
import type {Map_Package_Json} from './package_json.js';

export interface Gro_Config {
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
	task_root_paths: string[];
	// TODO `task_discovery_paths`
}

export interface Create_Gro_Config {
	(base_config: Gro_Config): Gro_Config | Promise<Gro_Config>;
}

export const create_empty_config = (): Gro_Config => ({
	plugins: () => [],
	// TODO maybe disable if no SvelteKit `lib` directory? or other detection to improve defaults
	map_package_json: default_map_package_json,
	task_root_paths: [paths.lib, paths.root, IS_THIS_GRO ? null! : GRO_DIST_DIR].filter(Boolean),
});

const default_map_package_json: Map_Package_Json = async (package_json) => {
	if (package_json.exports) {
		package_json.exports = Object.fromEntries(
			Object.entries(package_json.exports).filter(([k]) => !DEFAULT_EXPORTS_EXCLUDER.test(k)),
		);
	}
	return package_json;
};

export const DEFAULT_EXPORTS_EXCLUDER = /(\.md|\.(test|ignore)\.|\/(test|fixtures|ignore)\/)/u;

export interface Gro_Config_Module {
	readonly default: Gro_Config | Create_Gro_Config;
}

export const load_config = async (dir = paths.root): Promise<Gro_Config> => {
	const default_config = await create_default_config(create_empty_config());
	const config_path = join(dir, GRO_CONFIG_PATH);
	let config: Gro_Config;
	if (await exists(config_path)) {
		const config_module = await import(config_path);
		validate_config_module(config_module, config_path);
		config =
			typeof config_module.default === 'function'
				? await config_module.default(default_config)
				: config_module.default;
		normalize_config(config);
	} else {
		config = default_config;
	}
	return config;
};

// Mutates `config` with cleaned up values.
const normalize_config = (config: Gro_Config): void => {
	// TODO any validation?
	config.task_root_paths = config.task_root_paths.map((p) => resolve(p));
};

export const validate_config_module: (
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
