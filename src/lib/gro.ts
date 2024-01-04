#!/usr/bin/env node

import {join} from 'node:path';
import {spawn} from '@grogarden/util/process.js';

import {find_gro_path} from './gro_helpers.js';

/*

This file is a loader for the Gro CLI.
Its only purpose is to import the `invoke.js` script in the correct directory.
It lets the global Gro CLI defer to a local installation of Gro if one is available,
and it also provides special handling for the case
where we're running Gro inside Gro's own repo for development.

*/

const path = await find_gro_path('invoke.js');
console.log(`path`, path);

const loader_path = join(path, '../loader.js');

const result = await spawn('node', [
	'--import',
	`data:text/javascript,
		import {register} from "node:module";
		import {pathToFileURL} from "node:url";
		register("${loader_path}", pathToFileURL("./"));`,
	'--enable-source-maps',
	path,
	...process.argv.slice(2),
]);

if (!result.ok) {
	process.exit(result.code || 1);
}
