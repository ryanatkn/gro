import {join} from 'node:path';

import {CONFIG_PATH, paths} from './paths.js';
import create_default_config from './gro.config.default.js';
import type {CreateConfigPlugins} from './plugin.js';
import {exists} from './exists.js';
import type {MapPackageJson} from './package_json.js';

// TODO move the config to the root out of src/

/*

See `../docs/config.md` for documentation.

The Gro config tells Gro how to build and manage a project.
Dependent projects can optionally define one at `gro.config.ts`.
If none is provided, the fallback is located at `gro/src/lib/gro.config.default.ts`.

*/

export interface GroConfig {
	plugins: CreateConfigPlugins;
	/**
	 * Maps the project's `package.json` before writing it to the filesystem.
	 * The `pkg` argument may be mutated, but the return value is what's used by the caller.
	 * Returning `null` is a no-op for the caller.
	 */
	package_json: MapPackageJson | null;
}

export interface CreateGroConfig {
	(base_config: GroConfig): GroConfig | Promise<GroConfig>;
}

export const create_empty_config = (): GroConfig => ({
	plugins: () => [],
	package_json: null,
});

export interface GroConfigModule {
	readonly default: GroConfig | CreateGroConfig;
}

export const load_config = async (dir = paths.root): Promise<GroConfig> => {
	const default_config = await create_default_config(create_empty_config());
	const config_path = join(dir, CONFIG_PATH);
	let config: GroConfig;
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
) => asserts config_module is GroConfigModule = (config_module, config_path) => {
	const config = config_module.default;
	if (!config) {
		throw Error(`Invalid Gro config module at ${config_path}: expected a default export`);
	} else if (!(typeof config === 'function' || typeof config === 'object')) {
		throw Error(
			`Invalid Gro config module at ${config_path}: the default export must be a function or object`,
		);
	}
};
