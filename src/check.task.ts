import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {findGenModules} from './gen/genModule.js';

const Args = z
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
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'check that everything is ready to commit',
	Args,
	run: async ({fs, log, args, invokeTask}) => {
		const {typecheck, test, gen, format, lint} = args;

		if (typecheck) {
			await invokeTask('typecheck');
		}

		if (test) {
			await invokeTask('test');
		}

		if (gen) {
			// Check for stale code generation if the project has any gen files.
			const findGenModulesResult = await findGenModules(fs);
			if (findGenModulesResult.ok) {
				log.info('checking that generated files have not changed');
				await invokeTask('gen', {check: true, rebuild: false});
			} else if (findGenModulesResult.type !== 'inputDirectoriesWithNoFiles') {
				for (const reason of findGenModulesResult.reasons) {
					log.error(reason);
				}
				throw new TaskError('Failed to find gen modules.');
			}
		}

		if (format) {
			await invokeTask('format', {check: true});
		}

		// Run the linter last to surface every other kind of problem first.
		// It's not the ideal order when the linter would catch errors that cause failing tests,
		// but it's better for most usage.
		if (lint) {
			await invokeTask('lint');
		}
	},
};
