import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';

import type {Task} from 'src/task/task.js';
import {SOURCE_DIRNAME} from './paths.js';
import {TaskError} from './task/task.js';

export const task: Task = {
	summary: 'typecheck the project without emitting any files',
	run: async (): Promise<void> => {
		const tscTypecheckResult = await spawn('npx', ['tsc', '--noEmit']);
		if (!tscTypecheckResult.ok) {
			throw new TaskError(`Failed to typecheck. ${printSpawnResult(tscTypecheckResult)}`);
		}
		const svelteCheckResult = await spawn('npx', ['svelte-check', '--workspace', SOURCE_DIRNAME]);
		if (!svelteCheckResult.ok) {
			throw new TaskError(`Failed to typecheck Svelte. ${printSpawnResult(svelteCheckResult)}`);
		}
	},
};
