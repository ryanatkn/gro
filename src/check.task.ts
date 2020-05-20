import {Task} from './task/task.js';
import {task as typecheckTask} from './typecheck.task.js';
import {task as testTask} from './test.task.js';
import {task as genTask} from './gen.task.js';
import {task as formatTask} from './format.task.js';

export const task: Task = {
	description: 'check that everything is ready to commit',
	run: async (ctx) => {
		const {log} = ctx;

		log.info('typechecking');
		await typecheckTask.run(ctx);

		log.info('testing');
		await testTask.run(ctx);

		log.info('checking that generated files have not changed');
		await genTask.run({...ctx, args: {...ctx.args, check: true}});

		log.info('checking that all files are formatted correctly');
		await formatTask.run({...ctx, args: {...ctx.args, check: true}});
	},
};
