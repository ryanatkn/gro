import {join} from 'node:path';

import {CONFIG_PATH, paths} from './paths.js';
import create_default_config from './gro.config.default.js';
import type {Create_Config_Plugins} from './plugin.js';
import {exists} from './exists.js';
import type {Map_Package_Json} from './package_json.js';

export interface Gro_Config {
	plugins: Create_Config_Plugins;
	/**
	 * Maps the project's `package.json` before writing it to the filesystem.
	 * The `pkg` argument may be mutated, but the return value is what's used by the caller.
	 * Returning `null` is a no-op for the caller.
	 */
	map_package_json: Map_Package_Json | null;
}

export interface Create_Gro_Config {
	(base_config: Gro_Config): Gro_Config | Promise<Gro_Config>;
}

export const create_empty_config = (): Gro_Config => ({
	plugins: () => [],
	// TODO maybe disable if no SvelteKit `lib` directory? or other detection to improve defaults
	map_package_json: default_map_package_json,
});

const default_map_package_json: Map_Package_Json = async (pkg) => {
	if (pkg.exports) {
		pkg.exports = Object.fromEntries(
			Object.entries(pkg.exports).filter(([k]) => !DEFAULT_EXPORTS_EXCLUDE.test(k)),
		);
	}
	return pkg;
};
const DEFAULT_EXPORTS_EXCLUDE = /(\.md|\.(test|ignore)\.|\/(test|fixtures|ignore)\/)/u;

export interface Gro_Config_Module {
	readonly default: Gro_Config | Create_Gro_Config;
}

export const load_config = async (dir = paths.root): Promise<Gro_Config> => {
	const default_config = await create_default_config(create_empty_config());
	const config_path = join(dir, CONFIG_PATH);
	let config: Gro_Config;
	if (await exists(config_path)) {
		const config_module = await import(config_path);
		validate_config_module(config_module, config_path);
		config =
			typeof config_module.default === 'function'
				? await config_module.default(default_config)
				: config_module.default;
	} else {
		config = default_config;
	}
	return config;
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
