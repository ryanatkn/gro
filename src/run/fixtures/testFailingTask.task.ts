import {Task} from '../task.js';

export const task: Task = {
	run: async (): Promise<void> => {
		throw Error('Test task experienced great failure');
	},
};
