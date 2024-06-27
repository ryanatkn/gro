import type {Result} from '@ryanatkn/belt/result.js';
import {existsSync} from 'node:fs';

import {Package_Json, load_package_json} from './package_json.js';
import {sveltekit_config_global} from './sveltekit_config_global.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {SVELTEKIT_CONFIG_FILENAME, SVELTEKIT_DEV_DIRNAME} from './path_constants.js';
import {find_cli, spawn_cli} from './cli.js';
import {Task_Error} from './task.js';

export const SVELTEKIT_CLI = 'svelte-kit';

export const SVELTE_CHECK_CLI = 'svelte-check';

export const SVELTE_PACKAGE_CLI = 'svelte-package';
export const SVELTE_PACKAGE_DEP_NAME = '@sveltejs/package';

export const has_sveltekit_app = async (): Promise<Result<object, {message: string}>> => {
	if (!existsSync(SVELTEKIT_CONFIG_FILENAME)) {
		return {ok: false, message: `no SvelteKit config found at ${SVELTEKIT_CONFIG_FILENAME}`};
	}
	// TODO check for routes?
	return {ok: true};
};

export const has_sveltekit_library = async (
	package_json?: Package_Json,
	sveltekit_config: Parsed_Sveltekit_Config = sveltekit_config_global,
): Promise<Result<object, {message: string}>> => {
	const has_sveltekit_app_result = await has_sveltekit_app();
	if (!has_sveltekit_app_result.ok) {
		return has_sveltekit_app_result;
	}

	if (!existsSync(sveltekit_config.lib_path)) {
		return {ok: false, message: `no SvelteKit lib directory found at ${sveltekit_config.lib_path}`};
	}

	const pkg = package_json ?? (await load_package_json());
	if (
		!(pkg.devDependencies?.[SVELTE_PACKAGE_DEP_NAME] || pkg.dependencies?.[SVELTE_PACKAGE_DEP_NAME])
	) {
		return {
			ok: false,
			message: `no dependency found in package.json for ${SVELTE_PACKAGE_DEP_NAME}, install it with \`npm i -D ${SVELTE_PACKAGE_DEP_NAME}\``,
		};
	}

	return {ok: true};
};

export const sveltekit_sync = async (): Promise<void> => {
	if (!(await find_cli(SVELTEKIT_CLI))) {
		throw new Task_Error(`Failed to find ${SVELTEKIT_CLI} CLI - do you need to run \`npm i\`?`);
	}
	const result = await spawn_cli(SVELTEKIT_CLI, ['sync']);
	if (!result?.ok) {
		throw new Task_Error(`Failed ${SVELTEKIT_CLI} sync`);
	}
};

/**
 * If the SvelteKit CLI is found and its `.svelte-kit` directory is not, run `svelte-kit sync`.
 */
export const sveltekit_sync_if_obviously_needed = async (): Promise<void> => {
	if (existsSync(SVELTEKIT_DEV_DIRNAME)) {
		return;
	}
	if (!(await find_cli(SVELTEKIT_CLI))) {
		return;
	}
	return sveltekit_sync();
};
