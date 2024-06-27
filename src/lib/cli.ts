import type {SpawnOptions} from 'node:child_process';
import {spawn, spawn_out, type Spawn_Result} from '@ryanatkn/belt/process.js';
import {join} from 'node:path';
import {existsSync} from 'node:fs';

import {NODE_MODULES_DIRNAME} from './path_constants.js';
import type {Path_Id} from './path.js';

export type Cli =
	| {kind: 'local'; name: string; id: Path_Id}
	| {kind: 'global'; name: string; id: Path_Id};

/**
 * Looks for the CLI `name`, first local to the cwd and then globally.
 */
export const find_cli = async (name: string, cwd = process.cwd()): Promise<Cli | null> => {
	const local_id = join(cwd, NODE_MODULES_DIRNAME, `.bin/${name}`);
	if (existsSync(local_id)) {
		return {name, id: local_id, kind: 'local'};
	}
	const {stdout} = await spawn_out('which', [name]);
	const global_id = stdout?.trim();
	if (!global_id) return null;
	return {name, id: global_id, kind: 'global'};
};

/**
 * Calls the CLI `name` if available, first local to the cwd and then globally.
 */
export const spawn_cli = async (
	name: string,
	args: any[] = [],
	options?: SpawnOptions | undefined,
): Promise<Spawn_Result | undefined> => {
	const found = await find_cli(name);
	if (!found) return;
	return spawn(found.id, args, options);
};
