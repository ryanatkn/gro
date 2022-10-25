import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {findGenModules} from './gen/genModule.js';
import type {ArgsSchema} from './utils/args.js';
import {toVocabSchema} from './utils/schema.js';

const Args = z.object({
	typecheck: z.boolean({description: ''}).default(true).optional(),
	'no-typecheck': z.boolean({description: 'opt out of typechecking'}).default(false).optional(),
	test: z.boolean({description: ''}).default(true).optional(),
	'no-test': z.boolean({description: 'opt out of running tests'}).default(false).optional(),
	gen: z.boolean({description: ''}).default(true).optional(),
	'no-gen': z.boolean({description: 'opt out of gen check'}).default(false).optional(),
	format: z.boolean({description: ''}).default(true).optional(),
	'no-format': z.boolean({description: 'opt out of format check'}).default(false).optional(),
	lint: z.boolean({description: ''}).default(true).optional(),
	'no-lint': z.boolean({description: 'opt out of linting'}).default(false).optional(),
});
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'check that everything is ready to commit',
	Args,
	args: toVocabSchema(Args, 'CheckTaskArgs') as ArgsSchema,
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
				await invokeTask('gen', {check: true});
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
