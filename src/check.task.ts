import {Task} from './task/task.js';
import {task as typecheckTask} from './typecheck.task.js';
import {task as testTask} from './test.task.js';

export const task: Task = {
	description: 'check that everything is ready to commit',
	run: async ctx => {
		const {log} = ctx;

		log.info('typechecking');
		await typecheckTask.run(ctx);

		log.info('testing');
		await testTask.run(ctx);
	},
};
