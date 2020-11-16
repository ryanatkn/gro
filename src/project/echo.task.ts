import {Task} from '../task/task.js';

export const task: Task = {
	description: 'diagnostic task that logs CLI args',
	run: async ({args}) => {
		console.log(args);
	},
};
