import {spawn} from '@feltcoop/felt/util/process.js';
import type {Spawn_Result} from '@feltcoop/felt/util/process.js';

import {
	GITHUB_DIRNAME,
	paths,
	README_FILENAME,
	SVELTEKIT_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
} from '../paths.js';

const DEFAULT_EXTENSIONS = 'ts,js,json,svelte,html,css,md,yml';
const DEFAULT_ROOT_PATHS = `${[
	README_FILENAME,
	SVELTEKIT_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
	GITHUB_DIRNAME,
].join(',')}/**/*`;

// This formats a directory on the filesystem.
// If the source directory is given, it also formats all of the root directory files.
// This is separated from `./format_file` to avoid importing all of the `prettier` code
// inside modules that import this one. (which has a nontrivial cost)
export const format_directory = (
	directory: string,
	check = false,
	extensions = DEFAULT_EXTENSIONS,
	root_paths = DEFAULT_ROOT_PATHS,
): Promise<Spawn_Result> => {
	const prettier_args = ['prettier', check ? '--check' : '--write'];
	prettier_args.push(`${directory}**/*.{${extensions}}`);
	if (directory === paths.source) {
		prettier_args.push(`${paths.root}{${root_paths}}`);
	}
	return spawn('npx', prettier_args);
};
