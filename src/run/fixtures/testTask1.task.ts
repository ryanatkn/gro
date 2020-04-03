import {Task} from '../task.js';

export const task: Task = {
	run: async ({log: {info}}, data) => {
		info('test task 1!');
		return {
			...data,
			foo: 1,
		};
	},
};
