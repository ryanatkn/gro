#!/usr/bin/env node

import {join} from 'node:path';

import {resolve_gro_module_path, spawn_with_loader} from './gro_helpers.js';

/*

This file is a loader for the Gro CLI.
Its only purpose is to import the `invoke.js` script in the correct directory.
By using `resolve_gro_module_path` it lets the global Gro CLI defer
to a local installation of Gro if one is available,
and it also provides special handling for the case
where we're running Gro inside Gro's own repo for development.

*/

const invoke_path = resolve_gro_module_path('invoke.js');

const loader_path = join(invoke_path, '../loader.js');

const spawned = await spawn_with_loader(loader_path, invoke_path, process.argv.slice(2));
if (!spawned.ok) {
	process.exit(spawned.code || 1); // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
}
