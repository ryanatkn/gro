import {Task} from '../task.js';

export const task: Task = {
	description: 'a test task for basic task behavior',
	run: async ({log, args}) => {
		log.info('test task 1!', args);
		return args;
	},
};
