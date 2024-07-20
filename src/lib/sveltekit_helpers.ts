import type {Result} from '@ryanatkn/belt/result.js';
import {existsSync} from 'node:fs';

import {Package_Json, load_package_json} from './package_json.js';
import {default_sveltekit_config, type Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {SVELTEKIT_CONFIG_FILENAME, SVELTEKIT_DEV_DIRNAME} from './path_constants.js';
import {find_cli, spawn_cli, to_cli_name, type Cli} from './cli.js';
import {Task_Error} from './task.js';

export const SVELTEKIT_CLI = 'svelte-kit';

export const SVELTE_CHECK_CLI = 'svelte-check';

export const SVELTE_PACKAGE_CLI = 'svelte-package';
export const SVELTE_PACKAGE_DEP_NAME = '@sveltejs/package';

export const VITE_CLI = 'vite';

export const SVELTEKIT_ENV_MATCHER = /^\$env\/(static|dynamic)\/(public|private)$/;

export const has_sveltekit_app = (): Result<object, {message: string}> => {
	if (!existsSync(SVELTEKIT_CONFIG_FILENAME)) {
		return {ok: false, message: `no SvelteKit config found at ${SVELTEKIT_CONFIG_FILENAME}`};
	}
	// TODO check for routes?
	return {ok: true};
};

export const has_sveltekit_library = (
	package_json?: Package_Json,
	sveltekit_config: Parsed_Sveltekit_Config = default_sveltekit_config,
): Result<object, {message: string}> => {
	const has_sveltekit_app_result = has_sveltekit_app();
	if (!has_sveltekit_app_result.ok) {
		return has_sveltekit_app_result;
	}

	if (!existsSync(sveltekit_config.lib_path)) {
		return {ok: false, message: `no SvelteKit lib directory found at ${sveltekit_config.lib_path}`};
	}

	const pkg = package_json ?? load_package_json();
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

export const sveltekit_sync = async (
	sveltekit_cli: string | Cli = SVELTEKIT_CLI,
): Promise<void> => {
	const result = await spawn_cli(sveltekit_cli, ['sync']);
	if (!result) {
		throw new Task_Error(
			`Failed to find SvelteKit CLI \`${to_cli_name(sveltekit_cli)}\`, do you need to run \`npm i\`?`,
		);
	} else if (!result.ok) {
		throw new Task_Error(`Failed ${to_cli_name(sveltekit_cli)} sync`);
	}
};

/**
 * If the SvelteKit CLI is found and its `.svelte-kit` directory is not, run `svelte-kit sync`.
 */
export const sveltekit_sync_if_obviously_needed = async (
	sveltekit_cli: string | Cli = SVELTEKIT_CLI,
): Promise<void> => {
	if (existsSync(SVELTEKIT_DEV_DIRNAME)) {
		return;
	}
	const found_sveltekit_cli =
		typeof sveltekit_cli === 'string' ? find_cli(sveltekit_cli) : sveltekit_cli;
	if (!found_sveltekit_cli) {
		return;
	}
	return sveltekit_sync(found_sveltekit_cli);
};

/**
 * Options to the SvelteKit packaging CLI.
 * @see https://kit.svelte.dev/docs/packaging#options
 */
export interface Svelte_Package_Options {
	/**
	 * Watch files in src/lib for changes and rebuild the package
	 */
	watch?: boolean;
	/**
	 * Alias for `watch`.
	 */
	w?: boolean;
	/**
	 * The input directory which contains all the files of the package.
	 * Defaults to src/lib
	 */
	input?: string;
	/**
	 * Alias for `input`.
	 */
	i?: string;
	/**
	 * The output directory where the processed files are written to.
	 * Your package.json's exports should point to files inside there,
	 * and the files array should include that folder.
	 * Defaults to dist
	 */
	output?: string;
	/**
	 * Alias for `output`.
	 */
	o?: string;
	/**
	 * Whether or not to create type definitions (d.ts files).
	 * We strongly recommend doing this as it fosters ecosystem library quality.
	 * Defaults to true
	 */
	types?: boolean;
	/**
	 * Alias for `types`.
	 */
	t?: boolean;
	/**
	 * The path to a tsconfig or jsconfig.
	 * When not provided, searches for the next upper tsconfig/jsconfig in the workspace path.
	 */
	tsconfig?: string;
}
