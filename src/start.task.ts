import type {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';

export const task: Task = {
	description: 'alias for npm start',
	run: async () => {
		await spawnProcess('npm', ['start', ...process.argv.slice(3)]);
	},
};
