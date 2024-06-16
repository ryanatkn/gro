import {Package_Json, load_package_json} from './package_json.js';
import {exists} from './fs.js';
import {sveltekit_config_global} from './sveltekit_config_global.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {SVELTEKIT_CONFIG_FILENAME} from './path_constants.js';
import {find_cli, spawn_cli} from './cli.js';
import {Task_Error} from './task.js';

export const has_sveltekit_app = (): Promise<boolean> => exists(SVELTEKIT_CONFIG_FILENAME);

export const has_sveltekit_library = async (
	package_json?: Package_Json,
	sveltekit_config: Parsed_Sveltekit_Config = sveltekit_config_global,
): Promise<boolean> => {
	if (!(await has_sveltekit_app()) || !(await exists(sveltekit_config.lib_path))) {
		return false;
	}
	const p = package_json ?? (await load_package_json());
	return !!p.devDependencies?.['@sveltejs/package'] || !!p.dependencies?.['@sveltejs/package'];
};

export const sveltekit_sync = async (): Promise<void> => {
	if (!(await find_cli('svelte-kit'))) {
		throw new Task_Error('failed to find svelte-kit CLI - do you need to run `npm i`?');
	}
	const result = await spawn_cli('svelte-kit', ['sync']);
	if (!result?.ok) {
		throw new Task_Error(`failed svelte-kit sync`);
	}
};
