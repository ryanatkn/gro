import {Task} from '../task/task.js';

export const task: Task = {
	description: 'build, create, and link the distribution',
	run: async ({invokeTask}) => {
		await invokeTask('compile');
		await invokeTask('project/dist');
	},
};
