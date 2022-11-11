import {printSpawnResult, spawn} from '@feltcoop/util/process.js';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from './utils/args.js';
import {sveltekitSync} from './utils/sveltekit.js';

const Args = z
	.object({
		tsconfig: z.string({description: 'path to tsconfig.json'}).default('tsconfig.json'),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'typecheck the project without emitting any files',
	Args,
	run: async ({fs, args, log}): Promise<void> => {
		const {tsconfig} = args;

		await sveltekitSync(fs);

		if (await fs.exists('node_modules/.bin/svelte-check')) {
			// svelte-check
			const forwardedSvelteCheckArgs = toForwardedArgs('svelte-check');
			if (!forwardedSvelteCheckArgs.tsconfig) forwardedSvelteCheckArgs.tsconfig = tsconfig;
			const serializedSvelteCheckArgs = [
				'svelte-check',
				...serializeArgs(forwardedSvelteCheckArgs),
			];
			log.info(printCommandArgs(serializedSvelteCheckArgs));
			const tscResult = await spawn('npx', serializedSvelteCheckArgs);
			if (!tscResult.ok) {
				throw new TaskError(`Failed to typecheck. ${printSpawnResult(tscResult)}`);
			}
		} else {
			// tsc
			const forwardedTscArgs = toForwardedArgs('tsc');
			if (!forwardedTscArgs.noEmit) forwardedTscArgs.noEmit = true;
			const serializedTscArgs = ['tsc', ...serializeArgs(forwardedTscArgs)];
			log.info(printCommandArgs(serializedTscArgs));
			const svelteCheckResult = await spawn('npx', serializedTscArgs);
			if (svelteCheckResult && !svelteCheckResult.ok) {
				throw new TaskError(`Failed to typecheck. ${printSpawnResult(svelteCheckResult)}`);
			}
		}
	},
};
