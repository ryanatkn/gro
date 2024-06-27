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
import {spawn_cli} from './cli.js';

const PRETTIER_CLI = 'prettier';

const DEFAULT_EXTENSIONS = 'ts,js,json,svelte,html,css,md,yml';
const DEFAULT_ROOT_PATHS = `${[
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
	extensions = DEFAULT_EXTENSIONS,
	root_paths = DEFAULT_ROOT_PATHS,
	prettier_cli = PRETTIER_CLI,
): Promise<Spawn_Result> => {
	const forwarded_args = to_forwarded_args(prettier_cli);
	forwarded_args[check ? 'check' : 'write'] = true;
	const serialized_args = serialize_args(forwarded_args);
	serialized_args.push(`${dir}**/*.{${extensions}}`);
	if (dir === paths.source) {
		serialized_args.push(`${paths.root}{${root_paths}}`);
	}
	const spawned = await spawn_cli(prettier_cli, serialized_args, undefined, log);
	if (!spawned)
		throw new Error(
			`failed to find \`${prettier_cli}\` CLI locally or globally, do you need to run \`npm i\`?`,
		);
	return spawned;
};
