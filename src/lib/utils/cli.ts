import {execSync, type SpawnOptions} from 'node:child_process';
import {spawn, type SpawnResult} from '@feltjs/util/process.js';

import type {Filesystem} from '../fs/filesystem.js';

/**
 * Looks for the CLI `name`, first local to the cwd and then globally.
 */
export const findCli = async (fs: Filesystem, name: string): Promise<'local' | 'global' | null> => {
	if (await fs.exists(`node_modules/.bin/${name}`)) {
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
export const spawnCli = async (
	fs: Filesystem,
	name: string,
	args: any[] = [],
	options?: SpawnOptions | undefined,
): Promise<SpawnResult | undefined> => {
	const found = await findCli(fs, name);
	if (!found) return;
	const command = found === 'local' ? 'npx' : name;
	const finalArgs = found === 'local' ? [name].concat(args) : args;
	return spawn(command, finalArgs, options);
};
