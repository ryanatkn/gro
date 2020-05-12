import {Task} from './task/task.js';
import {assets} from './project/assets.js';
import {printPath} from './utils/print.js';
import {paths} from './paths.js';

export const task: Task = {
	description: 'copy assets to dist',
	run: async ({log}): Promise<void> => {
		log.info(`copying assets to ${printPath(paths.dist)}`);
		await assets();
	},
};
