import {Task} from '../task.js';

export const task: Task = {
	run: async ({log: {info}}, data) => {
		info('test task 2!');
		return {
			...data, // forward everything
			foo: data.foo + 1, // use the property added by testTask1
			bar: 'baz', // add a new property
		};
	},
};
