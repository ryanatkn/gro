import {Task} from '../task/task.js';

// TODO how should this be done?
process.env.NODE_ENV = 'production';

export const task: Task = {
	description: 'build, create, and link the distribution',
	run: async ({invokeTask}) => {
		await invokeTask('compile');
		await invokeTask('project/dist');
	},
};
