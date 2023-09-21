import {execSync, type SpawnOptions} from 'node:child_process';
import {spawn, type SpawnResult} from '@grogarden/util/process.js';
import {join} from 'node:path';

import {exists} from './exists.js';
import {NODE_MODULES_DIRNAME} from './paths.js';

/**
 * Looks for the CLI `name`, first local to the cwd and then globally.
 */
export const find_cli = async (name: string): Promise<'local' | 'global' | null> => {
	if (await exists(join(NODE_MODULES_DIRNAME, `.bin/${name}`))) {
		return 'local';
	}
	try {
		execSync(`command -v ${name} > /dev/null 2>&1`);
		return 'global';
	} catch (err) {
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
