import type {Result} from '@ryanatkn/belt/result.js';
import {existsSync} from 'node:fs';
import type {Logger} from '@ryanatkn/belt/log.js';
import {join} from 'node:path';
import type {Package_Json} from '@ryanatkn/belt/package_json.js';

import {has_dep} from './package_json.ts';
import {default_svelte_config, type Parsed_Svelte_Config} from './svelte_config.ts';
import {SVELTE_CONFIG_FILENAME, SVELTEKIT_DEV_DIRNAME, PM_CLI_DEFAULT} from './constants.ts';
import {find_cli, spawn_cli, to_cli_name, type Cli} from './cli.ts';
import {Task_Error} from './task.ts';
import {serialize_args, to_forwarded_args} from './args.ts';

export const SVELTEKIT_CLI = 'svelte-kit';

export const SVELTE_CHECK_CLI = 'svelte-check';

export const SVELTE_PACKAGE_CLI = 'svelte-package';
export const SVELTE_PACKAGE_DEP_NAME = '@sveltejs/package';

export const VITE_CLI = 'vite';

export const SVELTEKIT_ENV_MATCHER = /^\$env\/(static|dynamic)\/(public|private)$/;
export const SVELTEKIT_GLOBAL_SPECIFIER = /^\$(env|app)\//;

export const has_sveltekit_app = (
	svelte_config_path: string = SVELTE_CONFIG_FILENAME,
): Result<object, {message: string}> => {
	if (!existsSync(svelte_config_path)) {
		return {ok: false, message: `no SvelteKit config found at ${SVELTE_CONFIG_FILENAME}`};
	}
	// TODO check for routes?
	return {ok: true};
};

export const has_sveltekit_library = (
	package_json: Package_Json,
	svelte_config: Parsed_Svelte_Config = default_svelte_config,
	dep_name = SVELTE_PACKAGE_DEP_NAME,
): Result<object, {message: string}> => {
	const has_sveltekit_app_result = has_sveltekit_app();
	if (!has_sveltekit_app_result.ok) {
		return has_sveltekit_app_result;
	}

	if (!existsSync(svelte_config.lib_path)) {
		return {ok: false, message: `no SvelteKit lib directory found at ${svelte_config.lib_path}`};
	}

	if (!has_dep(dep_name, package_json)) {
		return {
			ok: false,
			message: `no dependency found in package.json for ${dep_name}`,
		};
	}

	return {ok: true};
};

export const sveltekit_sync = async (
	sveltekit_cli: string | Cli = SVELTEKIT_CLI,
	pm_cli = PM_CLI_DEFAULT, // TODO source from config when possible, is just needed for error messages
): Promise<void> => {
	const result = await spawn_cli(sveltekit_cli, ['sync']);
	if (!result) {
		throw new Task_Error(
			`Failed to find SvelteKit CLI \`${to_cli_name(sveltekit_cli)}\`, do you need to run \`${pm_cli} install\`?`,
		);
	} else if (!result.ok) {
		throw new Task_Error(`Failed ${to_cli_name(sveltekit_cli)} sync`);
	}
};

// TODO maybe this shouldn't exist, instead error if `package.json` has SvelteKit but it's not found (with install message above)
/**
 * If the SvelteKit CLI is found and its `.svelte-kit` directory is not, run `svelte-kit sync`.
 */
export const sveltekit_sync_if_available = async (
	sveltekit_cli: string | Cli = SVELTEKIT_CLI,
): Promise<void> => {
	const found_sveltekit_cli =
		typeof sveltekit_cli === 'string' ? find_cli(sveltekit_cli) : sveltekit_cli;
	if (found_sveltekit_cli) {
		return sveltekit_sync(found_sveltekit_cli);
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

export const run_svelte_package = async (
	package_json: Package_Json,
	options: Svelte_Package_Options | undefined,
	cli: string | Cli,
	log: Logger,
	pm_cli: string,
): Promise<void> => {
	const has_sveltekit_library_result = has_sveltekit_library(package_json);
	if (!has_sveltekit_library_result.ok) {
		throw new Task_Error(
			'Failed to find SvelteKit library: ' + has_sveltekit_library_result.message,
		);
	}
	const cli_name = typeof cli === 'string' ? cli : cli.name;
	const found_svelte_package_cli = cli === cli_name ? find_cli(cli) : (cli as Cli);
	if (found_svelte_package_cli?.kind !== 'local') {
		throw new Task_Error(
			`Failed to find SvelteKit packaging CLI \`${cli_name}\`, do you need to run \`${pm_cli} install\`?`,
		);
	}
	const serialized_args = serialize_args({
		...options,
		...to_forwarded_args(cli_name),
	});
	await spawn_cli(found_svelte_package_cli, serialized_args, log);
};

//
/**
 * Map an import specifier with the SvelteKit aliases.
 */
export const map_sveltekit_aliases = (
	specifier: string,
	aliases: Array<[string, string]>,
): string => {
	let path = specifier;
	for (const [from, to] of aliases) {
		if (path.startsWith(from)) {
			path = join(process.cwd(), to, path.substring(from.length));
			break;
		}
	}
	return path;
};
