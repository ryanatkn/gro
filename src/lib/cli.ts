import {execSync, type SpawnOptions} from 'node:child_process';
import {spawn, type SpawnResult} from '@grogarden/util/process.js';
import {join} from 'node:path';

import {exists} from './exists.js';
import {NODE_MODULES_DIRNAME} from './paths.js';

/**
 * Looks for the CLI `name`, first local to the cwd and then globally.
 */
export const find_cli = async (name: string): Promise<'local' | 'global' | null> => {
	console.log(`FIND CLI`, name);
	if (await exists(join(NODE_MODULES_DIRNAME, `.bin/${name}`))) {
		console.log('found local', name);
		return 'local';
	}
	try {
		// TODO BLOCK
		console.log(`FIND GLOBAL CLI!`, name);
		// execSync(`command -v ${name} > /dev/null 2>&1`);
		// console.log(`command worked`, name);
		const spawned = await spawn('command', ['-v name > /dev/null 2>&1']);
		console.log(`spawned`, spawned);
		console.log(`FOUND GLOBAL CLI`, name);
		return 'global';
	} catch (err) {
		console.log(`ERR CLI`, name);
		return null;
	}
};

/**
 * Calls the CLI `name` if available, first local to the cwd and then globally.
 */
export const spawn_cli = async (
	name: string,
	args: any[] = [],
	options?: SpawnOptions | undefined,
): Promise<SpawnResult | undefined> => {
	const found = await find_cli(name);
	if (!found) return;
	const command = found === 'local' ? 'npx' : name;
	const final_args = found === 'local' ? [name].concat(args) : args;
	return spawn(command, final_args, options);
};
