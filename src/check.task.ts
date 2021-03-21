import {Task, TaskError} from './task/task.js';
import {findGenModules} from './gen/genModule.js';

export const task: Task = {
	description: 'check that everything is ready to commit',
	run: async ({log, args, invokeTask}) => {
		await invokeTask('typecheck');

		// // Run tests only if the the project has some.
		// const findTestModulesResult = await findTestModules();
		// if (findTestModulesResult.ok) {
		await invokeTask('test');
		// } else if (findTestModulesResult.type !== 'inputDirectoriesWithNoFiles') {
		// 	for (const reason of findTestModulesResult.reasons) {
		// 		log.error(reason);
		// 	}
		// 	throw new TaskError('Failed to find task modules.');
		// }

		// Check for stale code generation if the project has any gen files.
		const findGenModulesResult = await findGenModules();
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
