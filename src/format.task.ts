import {printSpawnResult} from '@feltcoop/felt/util/process.js';

import type {Task} from 'src/task/task.js';
import {TaskError} from './task/task.js';
import {formatDirectory} from './format/formatDirectory.js';
import {paths} from './paths.js';

export interface TaskArgs {
	check?: boolean;
}

export const task: Task<TaskArgs> = {
	summary: 'format source files',
	run: async ({args}) => {
		const check = !!args.check;
		const formatResult = await formatDirectory(paths.source, check);
		if (!formatResult.ok) {
			throw new TaskError(
				`Failed ${check ? 'formatting check' : 'to format'}. ${printSpawnResult(formatResult)}`,
			);
		}
	},
};
