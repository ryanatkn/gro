import type {Filesystem} from '../fs/filesystem.js';
import {findCli, spawnCli} from './cli.js';
import {TaskError} from '../task/task.js';

export const sveltekitSync = async (fs: Filesystem): Promise<void> => {
	if (!(await findCli(fs, 'svelte-kit'))) {
		return;
	}
	const result = await spawnCli(fs, 'svelte-kit', ['sync']);
	if (!result?.ok) {
		throw new TaskError(`failed svelte-kit sync`);
	}
};
