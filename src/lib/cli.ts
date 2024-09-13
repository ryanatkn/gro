import {spawnSync, type SpawnOptions} from 'node:child_process';
import {
	spawn,
	spawn_process,
	type Spawn_Result,
	type Spawned_Process,
} from '@ryanatkn/belt/process.js';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath, type URL} from 'node:url';
import type {Logger} from '@ryanatkn/belt/log.js';

import {NODE_MODULES_DIRNAME} from './path_constants.js';
import type {Path_Id} from './path.js';
import {print_command_args} from './args.js';

// TODO maybe upstream to Belt?

export type Cli =
	| {kind: 'local'; name: string; id: Path_Id}
	| {kind: 'global'; name: string; id: Path_Id};

/**
 * Searches the filesystem for the CLI `name`, first local to the cwd and then globally.
 * @returns `null` if not found locally or globally
 */
export const find_cli = (
	name: string,
	cwd: string | URL = process.cwd(),
	options?: SpawnOptions,
): Cli | null => {
	const final_cwd = typeof cwd === 'string' ? cwd : fileURLToPath(cwd);
	const local_id = join(final_cwd, NODE_MODULES_DIRNAME, `.bin/${name}`);
	if (existsSync(local_id)) {
		return {name, id: local_id, kind: 'local'};
	}
	const {stdout} = spawnSync('which', [name], options);
	const global_id = stdout.toString().trim();
	if (!global_id) return null;
	return {name, id: global_id, kind: 'global'};
};

/**
 * Spawns a CLI if available using Belt's `spawn`.
 * If a string is provided for `name_or_cli`, it checks first local to the cwd and then globally.
 * @returns `undefined` if no CLI is found, or the spawn result
 */
export const spawn_cli = async (
	name_or_cli: string | Cli,
	args: string[] = [],
	log?: Logger,
	options?: SpawnOptions,
): Promise<Spawn_Result | undefined> => {
	const cli = resolve_cli(name_or_cli, args, options?.cwd, log, options);
	if (!cli) return;
	return spawn(cli.id, args, options);
};

/**
 * Spawns a CLI if available using Belt's `spawn_process`.
 * If a string is provided for `name_or_cli`, it checks first local to the cwd and then globally.
 * @returns `undefined` if no CLI is found, or the spawn result
 */
export const spawn_cli_process = (
	name_or_cli: string | Cli,
	args: string[] = [],
	log?: Logger,
	options?: SpawnOptions,
): Spawned_Process | undefined => {
	const cli = resolve_cli(name_or_cli, args, options?.cwd, log, options);
	if (!cli) return;
	return spawn_process(cli.id, args, options);
};

export const resolve_cli = (
	name_or_cli: string | Cli,
	args: string[] = [],
	cwd: string | URL | undefined,
	log?: Logger,
	options?: SpawnOptions,
): Cli | undefined => {
	let final_cli;
	if (typeof name_or_cli === 'string') {
		const found = find_cli(name_or_cli, cwd, options);
		if (!found) return;
		final_cli = found;
	} else {
		final_cli = name_or_cli;
	}
	if (log) {
		log.info(print_command_args([final_cli.name].concat(args)));
	}
	return final_cli;
};

export const to_cli_name = (cli: string | Cli): string =>
	typeof cli === 'string' ? cli : cli.name;
