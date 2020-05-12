import {Task} from '../task/task.js';
import {spawnProcess} from '../utils/process.js';
import {cleanBuild} from './clean.js';

export const task: Task = {
	description: 'build typescript in watch mode for development',
	run: async ({log}) => {
		await cleanBuild(log);
		await spawnProcess('node_modules/.bin/tsc', ['-w']);
	},
};
