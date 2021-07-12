import {print_spawn_result} from '@feltcoop/felt/util/process.js';

import type {Task} from 'src/task/task.js';
import {Task_Error} from './task/task.js';
import {format_directory} from './build/format_directory.js';
import {paths} from './paths.js';

export interface Task_Args {
	check?: boolean;
}

export const task: Task<Task_Args> = {
	summary: 'format source files',
	run: async ({args}) => {
		const check = !!args.check;
		const format_result = await format_directory(paths.source, check);
		if (!format_result.ok) {
			throw new Task_Error(
				`Failed ${check ? 'formatting check' : 'to format'}. ${print_spawn_result(format_result)}`,
			);
		}
	},
};
