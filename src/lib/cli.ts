import type {SpawnOptions} from 'node:child_process';
import {spawn, spawn_out, type Spawn_Result} from '@ryanatkn/belt/process.js';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

import {NODE_MODULES_DIRNAME} from './path_constants.js';
import type {Path_Id} from './path.js';

export type Cli =
	| {kind: 'local'; name: string; id: Path_Id}
	| {kind: 'global'; name: string; id: Path_Id};

/**
 * Searches the filesystem for the CLI `name`, first local to the cwd and then globally.
 * @returns `null` if not found locally or globally
 */
export const find_cli = async (
	name: string,
	cwd: string | URL = process.cwd(),
): Promise<Cli | null> => {
	const final_cwd = typeof cwd === 'string' ? cwd : fileURLToPath(cwd);
	const local_id = join(final_cwd, NODE_MODULES_DIRNAME, `.bin/${name}`);
	if (existsSync(local_id)) {
		return {name, id: local_id, kind: 'local'};
	}
	const {stdout} = await spawn_out('which', [name]);
	const global_id = stdout?.trim();
	if (!global_id) return null;
	return {name, id: global_id, kind: 'global'};
};

// TODO BLOCK add an option to log the args? see usage
/**
 * Spawns a CLI if available.
 * If a string is provided for `name_or_cli`, it checks first local to the cwd and then globally.
 * @returns `undefined` if no CLI is found, or the spawn result
 */
export const spawn_cli = async (
	name_or_cli: string | Cli,
	args: any[] = [],
	options?: SpawnOptions | undefined,
): Promise<Spawn_Result | undefined> => {
	let final_cli;
	if (typeof name_or_cli === 'string') {
		const found = await find_cli(name_or_cli, options?.cwd);
		if (!found) return;
		final_cli = found;
	} else {
		final_cli = name_or_cli;
	}
	return spawn(final_cli.id, args, options);
};
