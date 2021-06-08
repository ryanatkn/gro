import {spawn_process} from '@feltcoop/felt/utils/process.js';
import type {SpawnResult} from '@feltcoop/felt/utils/process.js';

import {
	GITHUB_DIRNAME,
	paths,
	README_FILENAME,
	SVELTEKIT_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
} from '../paths.js';

// TODO ?
const FORMATTED_EXTENSIONS = 'ts,js,json,svelte,html,css,md,yml';
const FORMATTED_ROOT_PATHS = `${[
	README_FILENAME,
	SVELTEKIT_CONFIG_FILENAME,
	TSCONFIG_FILENAME,
	GITHUB_DIRNAME,
].join(',')}/**/*`;

// This formats a directory on the filesystem.
// If the source directory is given, it also formats all of the root directory files.
// This is separated from `./format_file` to avoid importing all of the `prettier` code
// inside modules that import this one. (which has a nontrivial cost)
export const format_directory = (directory: string, check = false): Promise<SpawnResult> => {
	const prettier_args = ['prettier', check ? '--check' : '--write'];
	prettier_args.push(`${directory}**/*.{${FORMATTED_EXTENSIONS}}`);
	if (directory === paths.source) {
		prettier_args.push(`${paths.root}{${FORMATTED_ROOT_PATHS}}`);
	}
	return spawn_process('npx', prettier_args);
};
