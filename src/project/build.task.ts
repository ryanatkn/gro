import {Task} from '../task/task.js';
import {spawnProcess} from '../utils/process.js';
import {task as distTask} from './dist.task.js';
import {cleanBuild} from './clean.js';

// TODO `process.env.NODE_ENV = 'production'`?
// set it where? what will it be used for?

export const task: Task = {
	description: 'build, create, and link the distribution',
	run: async (ctx) => {
		const {log} = ctx;

		await cleanBuild(log);

		log.info('compiling typescript');
		await spawnProcess('node_modules/.bin/tsc');

		await distTask.run(ctx);
	},
};
