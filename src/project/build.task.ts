import {Task} from '../task/task.js';

export const task: Task = {
	description: 'build, create, and link the distribution',
	run: async ({invokeTask, args, log}) => {
		// TODO improve this - maybe this should be a global gro task flag?
		if (!args.D && !args.dev) {
			process.env.NODE_ENV = 'production';
		}
		log.info(`building for ${process.env.NODE_ENV}`);
		await invokeTask('compile');
		await invokeTask('project/dist');
	},
};
