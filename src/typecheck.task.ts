import {print_spawn_result, spawn_process} from '@feltcoop/felt/utils/process.js';

import type {Task} from './task/task.js';
import {Task_Error} from './task/task.js';

export const task: Task = {
	description: 'typecheck the project without emitting any files',
	run: async () => {
		const typecheck_result = await spawn_process('npx', ['tsc', '--noEmit']);
		if (!typecheck_result.ok) {
			throw new Task_Error(`Failed to typecheck. ${print_spawn_result(typecheck_result)}`);
		}
	},
};
