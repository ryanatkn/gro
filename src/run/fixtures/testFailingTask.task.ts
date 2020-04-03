import {Task} from '../task.js';

export const task: Task = {
	run: async () => {
		throw Error('Test task experienced great failure');
	},
};
