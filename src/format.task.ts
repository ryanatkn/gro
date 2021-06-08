import {print_spawn_result} from '@feltcoop/felt/utils/process.js';

import type {Task} from './task/task.js';
import {Task_Error} from './task/task.js';
import {format_directory} from './build/format_directory.js';
import {paths} from './paths.js';

export interface Task_Args {
	check?: boolean;
}

export const task: Task<Task_Args> = {
	description: 'format source files',
	run: async ({args}) => {
		const check = !!args.check;
		const formatResult = await format_directory(paths.source, check);
		if (!formatResult.ok) {
			throw new Task_Error(
				`Failed ${check ? 'formatting check' : 'to format'}. ${print_spawn_result(formatResult)}`,
			);
		}
	},
};
