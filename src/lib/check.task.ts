import {z} from 'zod';
import {spawn} from '@grogarden/util/process.js';
import {red} from 'kleur/colors';

import {TaskError, type Task} from './task.js';
import {git_check_clean_workspace} from './git.js';

export const Args = z
	.object({
		typecheck: z.boolean({description: 'dual of no-typecheck'}).default(true),
		'no-typecheck': z.boolean({description: 'opt out of typechecking'}).default(false),
		test: z.boolean({description: 'dual of no-test'}).default(true),
		'no-test': z.boolean({description: 'opt out of running tests'}).default(false),
		gen: z.boolean({description: 'dual of no-gen'}).default(true),
		'no-gen': z.boolean({description: 'opt out of gen check'}).default(false),
		format: z.boolean({description: 'dual of no-format'}).default(true),
		'no-format': z.boolean({description: 'opt out of format check'}).default(false),
		exports: z.boolean({description: 'dual of no-exports'}).default(true),
		'no-exports': z.boolean({description: 'opt out of exports check'}).default(false),
		lint: z.boolean({description: 'dual of no-lint'}).default(true),
		'no-lint': z.boolean({description: 'opt out of linting'}).default(false),
		workspace: z.boolean({description: 'call git_check_clean_workspace'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'check that everything is ready to commit',
	Args,
	run: async ({args, invoke_task, log}) => {
		const {typecheck, test, gen, format, exports, lint, workspace} = args;

		const sync = !workspace; // if checking the workspace, don't sync! would lead to misleading errors
		if (sync) {
			await invoke_task('sync');
		}

		if (typecheck) {
			await invoke_task('typecheck');
		}

		if (test) {
			await invoke_task('test');
		}

		if (gen) {
			await invoke_task('gen', {check: true});
		}

		if (format) {
			await invoke_task('format', {check: true});
		}

		if (exports) {
			await invoke_task('exports', {check: true});
		}

		// Run the linter last to surface every other kind of problem first.
		// It's not the ideal order when the linter would catch errors that cause failing tests,
		// but it's better for most usage.
		if (lint) {
			await invoke_task('lint');
		}

		if (workspace) {
			const error_message = await git_check_clean_workspace();
			if (error_message) {
				log.error(red('git status'));
				await spawn('git', ['status']);
				throw new TaskError('failed check for git_check_clean_workspace: ' + error_message);
			}
		}
	},
};
