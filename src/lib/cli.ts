import type {SpawnOptions} from 'node:child_process';
import {spawn, spawn_out, type Spawn_Result} from '@ryanatkn/belt/process.js';
import {join} from 'node:path';
import {existsSync} from 'node:fs';

import {NODE_MODULES_DIRNAME} from './path_constants.js';

export type Cli =
	| {kind: 'local'; name: string; path: string}
	| {kind: 'global'; name: string; path: string};

/**
 * Looks for the CLI `name`, first local to the cwd and then globally.
 */
export const find_cli = async (name: string, cwd = process.cwd()): Promise<Cli | null> => {
	const local_path = join(cwd, NODE_MODULES_DIRNAME, `.bin/${name}`);
	if (existsSync(local_path)) {
		return {name, path: local_path, kind: 'local'};
	}
	const {stdout} = await spawn_out('which', [name]);
	if (!stdout) return null;
	return {name, path: stdout.trim(), kind: 'global'};
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
	const command = found === 'local' ? 'npx' : name;
	const final_args = found === 'local' ? [name].concat(args) : args;
	return spawn(command, final_args, options);
};
