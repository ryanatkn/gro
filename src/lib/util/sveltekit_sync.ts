import type {Filesystem} from '../fs/filesystem.js';
import {find_cli, spawn_cli} from './cli.js';
import {TaskError} from '../task/task.js';

export const sveltekit_sync = async (fs: Filesystem): Promise<void> => {
	if (!(await find_cli(fs, 'svelte-kit'))) {
		return;
	}
	const result = await spawn_cli(fs, 'svelte-kit', ['sync']);
	if (!result?.ok) {
		throw new TaskError(`failed svelte-kit sync`);
	}
};
