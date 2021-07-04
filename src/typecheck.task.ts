import {print_spawn_result, spawn} from '@feltcoop/felt/util/process.js';

import type {Task} from './task/task.js';
import {Task_Error} from './task/task.js';

export const task: Task = {
	summary: 'typecheck the project without emitting any files',
	run: async (): Promise<void> => {
		const typecheck_result = await spawn('npx', ['tsc', '--noEmit']);
		if (!typecheck_result.ok) {
			throw new Task_Error(`Failed to typecheck. ${print_spawn_result(typecheck_result)}`);
		}
	},
};
