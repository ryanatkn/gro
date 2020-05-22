import {Task, TaskError} from './task/task.js';
import {task as typecheckTask} from './typecheck.task.js';
import {task as testTask} from './test.task.js';
import {task as genTask} from './gen.task.js';
import {task as formatTask} from './format.task.js';
import {findGenModules} from './gen/genModule.js';

export const task: Task = {
	description: 'check that everything is ready to commit',
	run: async (ctx) => {
		const {log} = ctx;

		log.info('typechecking');
		await typecheckTask.run(ctx);

		log.info('testing');
		await testTask.run(ctx);

		// Check for stale code generation if the project has any gen files.
		const findGenModulesResult = await findGenModules();
		if (findGenModulesResult.ok) {
			log.info('checking that generated files have not changed');
			await genTask.run({...ctx, args: {...ctx.args, check: true}});
		} else if (findGenModulesResult.type !== 'inputDirectoriesWithNoFiles') {
			for (const reason of findGenModulesResult.reasons) {
				log.error(reason);
			}
			throw new TaskError('Failed to find gen modules.');
		}

		log.info('checking that all files are formatted correctly');
		await formatTask.run({...ctx, args: {...ctx.args, check: true}});
	},
};
