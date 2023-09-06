#!/usr/bin/env node

import {existsSync, realpathSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from '@feltjs/util/process.js';

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

const main = async (): Promise<void> => {
	let path;

	const groBinPath = resolve('node_modules/.bin/gro');
	if (existsSync(groBinPath)) {
		// case 1
		// Prefer any locally installed version of Gro.
		path = join(realpathSync(groBinPath), '../invoke.js');
	} else {
		// case 2
		// If running Gro inside its own repo, require the local dist.
		// If the local dist is not yet built it will fall back to the global.
		const filePath = fileURLToPath(import.meta.url);
		const basePath = 'dist/cli';
		if (existsSync(`${basePath}/gro.js`) && existsSync(`${basePath}/invoke.js`)) {
			path = join(filePath, `../../../${basePath}/invoke.js`);
		} else {
			// case 3
			// Fall back to the version associated with the running CLI.
			path = join(filePath, '../invoke.js');
		}
	}

	await spawn('node', ['--loader', join(path, '../../loader.js'), path, ...process.argv.slice(2)]);
};

main().catch((err) => {
	console.error('Gro failed to invoke', err); // eslint-disable-line no-console
	throw err;
});
