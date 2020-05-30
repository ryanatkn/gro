import {Task} from './task/task.js';
import {assets} from './project/assets.js';

export const task: Task = {
	description: 'copy assets to dist',
	run: async (): Promise<void> => {
		await assets();
	},
};
