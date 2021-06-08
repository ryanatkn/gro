import type {Task} from './task/task.js';
import {Task_Error} from './task/task.js';
import {findGenModules} from './gen/genModule.js';

export const task: Task = {
	description: 'check that everything is ready to commit',
	run: async ({fs, log, args, invoke_task}) => {
		await invoke_task('typecheck');

		await invoke_task('test');

		// Check for stale code generation if the project has any gen files.
		const findGenModulesResult = await findGenModules(fs);
		if (findGenModulesResult.ok) {
			log.info('checking that generated files have not changed');
			await invoke_task('gen', {...args, check: true});
		} else if (findGenModulesResult.type !== 'inputDirectoriesWithNoFiles') {
			for (const reason of findGenModulesResult.reasons) {
				log.error(reason);
			}
			throw new Task_Error('Failed to find gen modules.');
		}

		await invoke_task('format', {...args, check: true});
	},
};
