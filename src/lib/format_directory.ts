import type {Spawn_Result} from '@ryanatkn/belt/process.js';
import type {Logger} from '@ryanatkn/belt/log.js';

import {paths} from './paths.js';
import {
	GITHUB_DIRNAME,
	README_FILENAME,
	SVELTEKIT_CONFIG_FILENAME,
	VITE_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
	GRO_CONFIG_PATH,
} from './path_constants.js';
import {serialize_args, to_forwarded_args} from './args.js';
import {spawn_cli, to_cli_name, type Cli} from './cli.js';
import {PM_CLI_DEFAULT} from './gro_config.js';

const PRETTIER_CLI_DEFAULT = 'prettier';

const EXTENSIONS_DEFAULT = 'ts,js,json,svelte,html,css,md,yml';
const ROOT_PATHS_DEFAULT = `${[
	README_FILENAME,
	GRO_CONFIG_PATH,
	SVELTEKIT_CONFIG_FILENAME,
	VITE_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
	GITHUB_DIRNAME,
].join(',')}/**/*`;

/**
 * Formats a directory on the filesystem.
 * If the source directory is given, it also formats all of the root directory files.
 * This is separated from `./format_file` to avoid importing all of the `prettier` code
 * inside modules that import this one. (which has a nontrivial cost)
 */
export const format_directory = async (
	log: Logger,
	dir: string,
	check = false,
	extensions = EXTENSIONS_DEFAULT,
	root_paths = ROOT_PATHS_DEFAULT,
	prettier_cli: string | Cli = PRETTIER_CLI_DEFAULT,
	pm_cli: string = PM_CLI_DEFAULT,
): Promise<Spawn_Result> => {
	const forwarded_args = to_forwarded_args(to_cli_name(prettier_cli));
	forwarded_args[check ? 'check' : 'write'] = true;
	const serialized_args = serialize_args(forwarded_args);
	serialized_args.push(`${dir}**/*.{${extensions}}`);
	if (dir === paths.source) {
		serialized_args.push(`${paths.root}{${root_paths}}`);
	}
	const spawned = await spawn_cli(prettier_cli, serialized_args, log);
	if (!spawned)
		throw new Error(
			`failed to find \`${to_cli_name(prettier_cli)}\` CLI locally or globally, do you need to run \`${pm_cli} install\`?`,
		);
	return spawned;
};
