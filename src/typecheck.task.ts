import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';

import type {Task} from 'src/task/task.js';
import {TaskError} from './task/task.js';

export const task: Task = {
	summary: 'typecheck the project without emitting any files',
	run: async (): Promise<void> => {
		const typecheckResult = await spawn('npx', ['tsc', '--noEmit']);
		if (!typecheckResult.ok) {
			throw new TaskError(`Failed to typecheck. ${printSpawnResult(typecheckResult)}`);
		}
	},
};
