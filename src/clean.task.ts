import {Task} from './task/task.js';
import {clean} from './project/clean.js';

export const task: Task = {
	description: 'Remove build and temp files',
	run: async ({log}): Promise<void> => {
		await clean(log);
	},
};
