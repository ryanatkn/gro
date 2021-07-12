import type {Task} from 'src/task/task.js';
import {Task_Error} from './task/task.js';
import {find_gen_modules} from './gen/gen_module.js';

export const task: Task = {
	summary: 'check that everything is ready to commit',
	run: async ({fs, log, args, invoke_task}) => {
		await invoke_task('typecheck');

		await invoke_task('test');

		// Check for stale code generation if the project has any gen files.
		const find_gen_modules_result = await find_gen_modules(fs);
		if (find_gen_modules_result.ok) {
			log.info('checking that generated files have not changed');
			await invoke_task('gen', {...args, check: true});
		} else if (find_gen_modules_result.type !== 'input_directories_with_no_files') {
			for (const reason of find_gen_modules_result.reasons) {
				log.error(reason);
			}
			throw new Task_Error('Failed to find gen modules.');
		}

		await invoke_task('format', {...args, check: true});
	},
};
