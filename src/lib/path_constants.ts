/*

This module is intended to have no dependencies to avoid over-imports in the CLI and loader.
If any of these become customizable from SvelteKit or Gro's configs, move them to `./paths.ts`.

*/

// TODO the slashes here are kinda gross - do we want to maintain the convention to have the trailing slash in most usage?

export const SOURCE_DIRNAME = 'src';
export const GRO_DIRNAME = '.gro';
export const GRO_DIST_PREFIX = 'dist_'; //
export const SERVER_DIST_PATH = 'dist_server'; // TODO should all of these be `_PATH` or should this be `DIRNAME`? also, add `_PLUGIN` to this name?
export const GRO_DEV_DIRNAME = GRO_DIRNAME + '/dev';
export const SOURCE_DIR = SOURCE_DIRNAME + '/';
export const GRO_DIR = GRO_DIRNAME + '/';
export const GRO_DEV_DIR = GRO_DEV_DIRNAME + '/';
export const GRO_CONFIG_PATH = 'gro.config.ts';
export const README_FILENAME = 'README.md';
export const SVELTEKIT_CONFIG_FILENAME = 'svelte.config.js';
export const VITE_CONFIG_FILENAME = 'vite.config.ts';
export const NODE_MODULES_DIRNAME = 'node_modules';
export const LOCKFILE_FILENAME = 'package-lock.json';
export const SVELTEKIT_DEV_DIRNAME = '.svelte-kit'; // TODO use Svelte config value `outDir`
export const SVELTEKIT_BUILD_DIRNAME = 'build';
export const SVELTEKIT_DIST_DIRNAME = 'dist';
export const SVELTEKIT_VITE_CACHE_PATH = NODE_MODULES_DIRNAME + '/.vite';
export const GITHUB_DIRNAME = '.github';
export const GIT_DIRNAME = '.git';
export const TSCONFIG_FILENAME = 'tsconfig.json';
