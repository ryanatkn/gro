import type {Task} from './task/task.js';
import {TaskError} from './task/task.js';
import {printSpawnResult, spawnProcess} from './utils/process.js';

export const task: Task = {
	description: 'typecheck the project without emitting any files',
	run: async () => {
		const typecheckResult = await spawnProcess('npx', ['tsc', '--noEmit']);
		if (!typecheckResult.ok) {
			throw new TaskError(`Failed to typecheck. ${printSpawnResult(typecheckResult)}`);
		}
	},
};
