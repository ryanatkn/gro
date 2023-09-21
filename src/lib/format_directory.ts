import {spawn, type SpawnResult} from '@feltjs/util/process.js';
import type {Logger} from '@feltjs/util/log.js';

import {
	GITHUB_DIRNAME,
	paths,
	README_FILENAME,
	SVELTEKIT_CONFIG_FILENAME,
	VITE_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
	CONFIG_PATH,
} from './paths.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';

const DEFAULT_EXTENSIONS = 'ts,js,json,svelte,html,css,md,yml';
const DEFAULT_ROOT_PATHS = `${[
	README_FILENAME,
	CONFIG_PATH,
	SVELTEKIT_CONFIG_FILENAME,
	VITE_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
	GITHUB_DIRNAME,
].join(',')}/**/*`;

// This formats a directory on the filesystem.
// If the source directory is given, it also formats all of the root directory files.
// This is separated from `./format_file` to avoid importing all of the `prettier` code
// inside modules that import this one. (which has a nontrivial cost)
export const format_directory = (
	log: Logger,
	directory: string,
	check = false,
	extensions = DEFAULT_EXTENSIONS,
	root_paths = DEFAULT_ROOT_PATHS,
): Promise<SpawnResult> => {
	const forwarded_args = to_forwarded_args('prettier');
	forwarded_args[check ? 'check' : 'write'] = true;
	const serialized_args = ['prettier', ...serialize_args(forwarded_args)];
	serialized_args.push(`${directory}**/*.{${extensions}}`);
	if (directory === paths.source) {
		serialized_args.push(`${paths.root}{${root_paths}}`);
	}
	log.info(print_command_args(serialized_args));
	return spawn('npx', serialized_args);
};
