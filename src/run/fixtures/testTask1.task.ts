import {Task} from '../task.js';

export const task: Task = {
	run: async ({log: {info}}) => {
		info('test task 1!');
	},
};
