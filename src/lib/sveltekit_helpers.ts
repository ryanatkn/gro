import {Package_Json, load_package_json} from './package_json.js';
import {exists} from './fs.js';
import {sveltekit_config_global} from './sveltekit_config_global.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {SVELTEKIT_CONFIG_FILENAME, SVELTEKIT_DEV_DIRNAME} from './path_constants.js';
import {find_cli, spawn_cli} from './cli.js';
import {Task_Error} from './task.js';

export const SVELTEKIT_CLI = 'svelte-kit';

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
	if (!(await find_cli(SVELTEKIT_CLI))) {
		throw new Task_Error(`failed to find ${SVELTEKIT_CLI} CLI - do you need to run \`npm i\`?`);
	}
	const result = await spawn_cli(SVELTEKIT_CLI, ['sync']);
	if (!result?.ok) {
		throw new Task_Error(`failed ${SVELTEKIT_CLI} sync`);
	}
};

/**
 * If the SvelteKit CLI is found and its `.svelte-kit` directory is not, run `svelte-kit sync`.
 */
export const sveltekit_sync_if_obviously_needed = async (): Promise<void> => {
	if (await exists(SVELTEKIT_DEV_DIRNAME)) {
		return;
	}
	if (!(await find_cli(SVELTEKIT_CLI))) {
		return;
	}
	return sveltekit_sync();
};
