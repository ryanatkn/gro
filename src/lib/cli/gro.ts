#!/usr/bin/env node

import {realpath} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from '@feltjs/util/process.js';

import {exists} from '../util/exists.js';
import {NODE_MODULES_DIRNAME} from '../util/paths.js';

/*

This file is a loader for the Gro CLI.
Its only purpose is to import the `invoke.js` script in the correct directory.
It lets the global Gro CLI defer to a local installation of Gro if one is available,
and it also provides special handling for the case
where we're running Gro inside Gro's own repo for development.

case 1:

We're in a directory that has a local installation of Gro at `node_modules/.bin/gro`.
Use this local version instead of the global.

case 2:

We're running Gro inside the Gro repo itself.

In this case, we use the build directory instead of dist.
There's a paradox here for using Gro inside itself -
ideally we use the dist directory because that's what's shipped,
but the build directory has all of the tests,
and loading two instances of its modules causes problems
like `instanceof` checks failing.
For now we'll just run from build and see if it causes any problems.
There's probably a better design in here somewhere.

case 3:

Fall back to invoking Gro from wherever the CLI is being executed.
When using the global CLI, this uses the global Gro installation.

*/

let path;

const gro_bin_path = resolve(NODE_MODULES_DIRNAME, '.bin/gro');
if (await exists(gro_bin_path)) {
	// case 1
	// Prefer any locally installed version of Gro.
	path = join(await realpath(gro_bin_path), '../invoke.js');
} else {
	// case 2
	// If running Gro inside its own repo, require the local dist.
	// If the local dist is not yet built it will fall back to the global.
	const file_path = fileURLToPath(import.meta.url);
	const base_path = 'dist/cli';
	if ((await exists(`${base_path}/gro.js`)) && (await exists(`${base_path}/invoke.js`))) {
		path = join(file_path, `../../../${base_path}/invoke.js`);
	} else {
		// case 3
		// Fall back to the version associated with the running CLI.
		path = join(file_path, '../invoke.js');
	}
}

const result = await spawn('node', [
	'--loader',
	join(path, '../../loader.js'),
	path,
	...process.argv.slice(2),
]);

if (!result.ok) {
	process.exit(result.code || 1);
}
