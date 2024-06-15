import {Package_Json, load_package_json} from './package_json.js';
import {exists} from './fs.js';
import {sveltekit_config_global} from './sveltekit_config_global.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {SVELTEKIT_CONFIG_FILENAME} from './path_constants.js';

export const has_sveltekit_library = async (
	package_json?: Package_Json,
	sveltekit_config: Parsed_Sveltekit_Config = sveltekit_config_global,
): Promise<boolean> => {
	const p = package_json ?? (await load_package_json());
	return (
		(!!p.devDependencies?.['@sveltejs/package'] || !!p.dependencies?.['@sveltejs/package']) &&
		(await exists(sveltekit_config.lib_path))
	);
};

export const has_sveltekit_app = (): Promise<boolean> => exists(SVELTEKIT_CONFIG_FILENAME);
