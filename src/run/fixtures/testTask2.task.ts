import {Task, TaskContext} from '../task.js';

export const task: Task = {
	run: async ({log: {info}}: TaskContext): Promise<void> => {
		info('test task 2!');
	},
};
