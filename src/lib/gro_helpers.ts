import {realpath} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {exists} from './fs.js';
import {NODE_MODULES_DIRNAME} from './paths.js';

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
export const find_gro_path = async (path = ''): Promise<string> => {
	const gro_bin_path = resolve(NODE_MODULES_DIRNAME, '.bin/gro');
	if (await exists(gro_bin_path)) {
		// case 1
		// Prefer any locally installed version of Gro.
		return join(await realpath(gro_bin_path), `../${path}`);
	} else {
		// case 2
		// If running Gro inside its own repo, require the local dist.
		// If the local dist is not yet built it will fall back to the global.
		const file_path = fileURLToPath(import.meta.url);
		const base_path = 'dist';
		if ((await exists(`${base_path}/gro.js`)) && (await exists(`${base_path}/${path}`))) {
			return join(file_path, `../../${base_path}/${path}`);
		} else {
			// case 3
			// Fall back to the version associated with the running CLI.
			return join(file_path, `../${path}`);
		}
	}
};
