import {type Task} from './task/task.js';
import {TaskError} from './task/task.js';
import {findGenModules} from './gen/genModule.js';

export const task: Task = {
	summary: 'check that everything is ready to commit',
	run: async ({fs, log, args, invokeTask}) => {
		await invokeTask('typecheck');

		await invokeTask('test');

		// Check for stale code generation if the project has any gen files.
		const findGenModulesResult = await findGenModules(fs);
		if (findGenModulesResult.ok) {
			log.info('checking that generated files have not changed');
			await invokeTask('gen', {...args, check: true});
		} else if (findGenModulesResult.type !== 'inputDirectoriesWithNoFiles') {
			for (const reason of findGenModulesResult.reasons) {
				log.error(reason);
			}
			throw new TaskError('Failed to find gen modules.');
		}

		await invokeTask('format', {...args, check: true});
	},
};
