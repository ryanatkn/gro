import type {Task} from './task/task.js';
import {TaskError} from './task/task.js';
import {formatDirectory} from './build/formatDirectory.js';
import {paths} from './paths.js';
import {printSpawnResult} from './utils/process.js';

export const task: Task = {
	description: 'format source files',
	run: async ({args}) => {
		const check = !!args.check; // TODO args declaration and validation
		const formatResult = await formatDirectory(paths.source, check);
		if (!formatResult.ok) {
			throw new TaskError(
				`Failed ${check ? 'formatting check' : 'to format'}. ${printSpawnResult(formatResult)}`,
			);
		}
	},
};
