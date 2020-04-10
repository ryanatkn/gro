import {Task} from '../task.js';

export const task: Task = {
	description: 'a test task for unhandled errors',
	run: async () => {
		throw Error('This is a failing test task');
	},
};
