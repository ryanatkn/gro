#!/usr/bin/env node

import {join} from 'node:path';
import {spawn} from '@grogarden/util/process.js';

import {resolve_gro_module_path} from './gro_helpers.js';

/*

This file is a loader for the Gro CLI.
Its only purpose is to import the `invoke.js` script in the correct directory.
By using `resolve_gro_module_path` it lets the global Gro CLI defer
to a local installation of Gro if one is available,
and it also provides special handling for the case
where we're running Gro inside Gro's own repo for development.

*/

const invoke_path = await resolve_gro_module_path('invoke.js');

const loader_path = join(invoke_path, '../loader.js');

const result = await spawn('node', [
	'--import',
	`data:text/javascript,
		import {register} from "node:module";
		import {pathToFileURL} from "node:url";
		register("${loader_path}", pathToFileURL("./"));`,
	'--enable-source-maps',
	invoke_path,
	...process.argv.slice(2),
]);

if (!result.ok) {
	process.exit(result.code || 1);
}
