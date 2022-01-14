import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';

import {TaskError, type Task} from './task/task.js';

export const task: Task = {
	summary: 'typecheck the project without emitting any files',
	run: async ({fs}): Promise<void> => {
		const tscTypecheckResult = await spawn('npx', ['tsc', '--noEmit']);
		if (!tscTypecheckResult.ok) {
			throw new TaskError(`Failed to typecheck. ${printSpawnResult(tscTypecheckResult)}`);
		}
		if (await fs.exists('node_modules/.bin/svelte-check')) {
			const svelteCheckResult = await spawn('npx', ['svelte-check', '--tsconfig', 'tsconfig.json']);
			if (!svelteCheckResult.ok) {
				throw new TaskError(`Failed to typecheck Svelte. ${printSpawnResult(svelteCheckResult)}`);
			}
		}
	},
};
