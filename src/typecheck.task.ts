import {printSpawnResult, spawn} from '@feltcoop/felt/util/process.js';

import {TaskError, type Task} from './task/task.js';
import type {TypecheckTaskArgs} from './typecheckTask.js';
import {TypecheckTaskArgsSchema} from './typecheckTask.schema.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from './utils/args.js';
import {SVELTEKIT_DEV_DIRNAME} from './paths.js';

export const task: Task<TypecheckTaskArgs> = {
	summary: 'typecheck the project without emitting any files',
	args: TypecheckTaskArgsSchema,
	run: async ({fs, args, log}): Promise<void> => {
		const {tsconfig} = args;

		// TODO refactor? maybe always call sync without checking first?
		if (!(await fs.exists(SVELTEKIT_DEV_DIRNAME + '/tsconfig.json'))) {
			const syncResult = await spawn('npx', ['svelte-kit', 'sync']);
			if (!syncResult.ok) {
				throw new TaskError(`Failed to call 'svelte-kit sync'.`);
			}
		}

		const forwardedTscArgs = toForwardedArgs('tsc');
		if (!forwardedTscArgs.noEmit) forwardedTscArgs.noEmit = true;
		const serializedTscArgs = ['tsc', ...serializeArgs(forwardedTscArgs)];
		log.info(printCommandArgs(serializedTscArgs));
		const tscTypecheckResult = await spawn('npx', serializedTscArgs);
		if (!tscTypecheckResult.ok) {
			throw new TaskError(`Failed to typecheck. ${printSpawnResult(tscTypecheckResult)}`);
		}

		if (await fs.exists('node_modules/.bin/svelte-check')) {
			const forwardedSvelteCheckArgs = toForwardedArgs('svelte-check');
			if (!forwardedSvelteCheckArgs.tsconfig) forwardedSvelteCheckArgs.tsconfig = tsconfig;
			const serializedSvelteCheckArgs = [
				'svelte-check',
				...serializeArgs(forwardedSvelteCheckArgs),
			];
			log.info(printCommandArgs(serializedSvelteCheckArgs));
			const svelteCheckResult = await spawn('npx', serializedSvelteCheckArgs);
			if (!svelteCheckResult.ok) {
				throw new TaskError(`Failed to typecheck Svelte. ${printSpawnResult(svelteCheckResult)}`);
			}
		}
	},
};
