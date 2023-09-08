import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {find_gen_modules} from './gen/gen_module.js';
import {log_error_reasons} from './task/log_task.js';

export const Args = z
	.object({
		typecheck: z
			.boolean({description: 'read this instead of no-typecheck'})
			.optional()
			.default(true),
		'no-typecheck': z.boolean({description: 'opt out of typechecking'}).optional().default(false),
		test: z.boolean({description: 'read this instead of no-test'}).optional().default(true),
		'no-test': z.boolean({description: 'opt out of running tests'}).optional().default(false),
		gen: z.boolean({description: 'read this instead of no-gen'}).optional().default(true),
		'no-gen': z.boolean({description: 'opt out of gen check'}).optional().default(false),
		format: z.boolean({description: 'read this instead of no-format'}).optional().default(true),
		'no-format': z.boolean({description: 'opt out of format check'}).optional().default(false),
		lint: z.boolean({description: 'read this instead of no-lint'}).optional().default(true),
		'no-lint': z.boolean({description: 'opt out of linting'}).optional().default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'check that everything is ready to commit',
	Args,
	run: async ({fs, log, args, invoke_task}) => {
		const {typecheck, test, gen, format, lint} = args;

		throw new TaskError('Failed to find gen modules.');

		if (typecheck) {
			await invoke_task('typecheck');
		}

		if (test) {
			await invoke_task('test');
		}

		if (gen) {
			// Check for stale code generation if the project has any gen files.
			const find_gen_modules_result = await find_gen_modules(fs);
			if (find_gen_modules_result.ok) {
				log.info('checking that generated files have not changed');
				await invoke_task('gen', {check: true, rebuild: false});
			} else if (find_gen_modules_result.type !== 'input_directories_with_no_files') {
				log_error_reasons(log, find_gen_modules_result.reasons);
				throw new TaskError('Failed to find gen modules.');
			}
		}

		if (format) {
			await invoke_task('format', {check: true});
		}

		// Run the linter last to surface every other kind of problem first.
		// It's not the ideal order when the linter would catch errors that cause failing tests,
		// but it's better for most usage.
		if (lint) {
			await invoke_task('lint');
		}
	},
};
