import {printSpawnResult} from '@feltcoop/felt/util/process.js';

import {TaskError, type Task} from './task/task.js';
import {formatDirectory} from './format/formatDirectory.js';
import {paths} from './paths.js';
import {type FormatTaskArgs} from './formatTask.js';
import {FormatTaskArgsSchema} from './formatTask.schema.js';

export interface TaskArgs {
	check?: boolean;
}

export const task: Task<FormatTaskArgs> = {
	summary: 'format source files',
	args: FormatTaskArgsSchema,
	run: async ({args}) => {
		const {check = false} = args;
		const formatResult = await formatDirectory(paths.source, check);
		if (!formatResult.ok) {
			throw new TaskError(
				`Failed ${check ? 'formatting check' : 'to format'}. ${printSpawnResult(formatResult)}`,
			);
		}
	},
};
