import {spawn} from '@feltcoop/felt/util/process.js';
import type {SpawnResult} from '@feltcoop/felt/util/process.js';

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
// This is separated from `./formatFile` to avoid importing all of the `prettier` code
// inside modules that import this one. (which has a nontrivial cost)
export const formatDirectory = (
	directory: string,
	check = false,
	extensions = DEFAULT_EXTENSIONS,
	rootPaths = DEFAULT_ROOT_PATHS,
): Promise<SpawnResult> => {
	const prettierArgs = ['prettier', check ? '--check' : '--write'];
	prettierArgs.push(`${directory}**/*.{${extensions}}`);
	if (directory === paths.source) {
		prettierArgs.push(`${paths.root}{${rootPaths}}`);
	}
	return spawn('npx', prettierArgs);
};
