import {Task} from '../task.js';

export const task: Task = {
	run: async () => {
		throw Error('This is a failing test task');
	},
};
