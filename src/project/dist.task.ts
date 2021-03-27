import type {Task} from '../task/task.js';

export const task: Task = {
	description: 'create and link the distribution',
	run: async ({invokeTask}) => {
		await invokeTask('dist');
		await invokeTask('project/link');
	},
};
