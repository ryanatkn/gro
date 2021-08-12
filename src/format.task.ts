import {print_spawn_result} from '@feltcoop/felt/util/process.js';

import type {Task} from 'src/task/task.js';
import {TaskError} from './task/task.js';
import {format_directory} from './build/format_directory.js';
import {paths} from './paths.js';

export interface TaskArgs {
	check?: boolean;
}

export const task: Task<TaskArgs> = {
	summary: 'format source files',
	run: async ({args}) => {
		const check = !!args.check;
		const format_result = await format_directory(paths.source, check);
		if (!format_result.ok) {
			throw new TaskError(
				`Failed ${check ? 'formatting check' : 'to format'}. ${print_spawn_result(format_result)}`,
			);
		}
	},
};
