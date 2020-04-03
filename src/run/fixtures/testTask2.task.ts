import {Task} from '../task.js';

export const task: Task = {
	run: async ({log: {info}}, data) => {
		info('test task 2!');
		return {
			...data,
			foo: data.foo + 1,
			bar: 'baz',
		};
	},
};
