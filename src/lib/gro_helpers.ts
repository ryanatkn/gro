import {realpath} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, type Spawn_Result} from '@ryanatkn/belt/process.js';
import {existsSync} from 'node:fs';

import {NODE_MODULES_DIRNAME, SVELTEKIT_DIST_DIRNAME} from './path_constants.js';

/*

This module is intended to have minimal dependencies to avoid over-imports in the CLI.

*/

/**
 * Resolves a path to an internal Gro file.
 * Prefers any local installation of Gro and falls back to the current CLI context.
 *
 * Uses heuristics to find `path`, so may fail in some rare corner cases.
 * Currently looks for `gro.js` as a sibling to the `path` arg for detection.
 * If this fails for your usecases, rename `gro.js` or open an issue/PR!
 *
 * Used by the CLI and `gro run`.
 *
 * case 1:
 *
 * We're in a directory that has a local installation of Gro at `node_modules/.bin/gro`.
 * Use this local version instead of the global.
 *
 * case 2:
 *
 * We're running Gro inside the Gro repo itself.
 *
 * In this case, we use the build directory instead of dist.
 * There's a paradox here for using Gro inside itself -
 * ideally we use the dist directory because that's what's shipped,
 * but the build directory has all of the tests,
 * and loading two instances of its modules causes problems
 * like `instanceof` checks failing.
 * For now we'll just run from build and see if it causes any problems.
 * There's probably a better design in here somewhere.
 *
 * case 3:
 *
 * Fall back to invoking Gro from wherever the CLI is being executed.
 * When using the global CLI, this uses the global Gro installation.
 *
 */
export const resolve_gro_module_path = async (path = ''): Promise<string> => {
	const gro_bin_path = resolve(NODE_MODULES_DIRNAME, '.bin/gro');
	// case 1
	// Prefer any locally installed version of Gro.
	if (existsSync(gro_bin_path)) {
		return join(await realpath(gro_bin_path), '..', path);
	}
	// case 2
	// If running Gro inside its own repo, require the local dist.
	// If the local dist is not yet built it will fall back to the global.
	if (
		existsSync(join(SVELTEKIT_DIST_DIRNAME, 'gro.js')) &&
		existsSync(join(SVELTEKIT_DIST_DIRNAME, path))
	) {
		return resolve(SVELTEKIT_DIST_DIRNAME, path);
	}
	// case 3
	// Fall back to the version associated with the running CLI.
	const file_path = fileURLToPath(import.meta.url);
	return join(file_path, '..', path);
};

/**
 * Runs a file using the Gro loader.
 *
 * @param loader_path path to loader
 * @param invoke_path path to file to spawn with `node`
 */
export const spawn_with_loader = async (
	loader_path: string,
	invoke_path: string,
	argv: string[],
): Promise<Spawn_Result> =>
	spawn('node', [
		'--import',
		`data:text/javascript,
			import {register} from "node:module";
			import {pathToFileURL} from "node:url";
			register("${loader_path}", pathToFileURL("./"));`,
		'--enable-source-maps',
		invoke_path,
		...argv,
	]);
