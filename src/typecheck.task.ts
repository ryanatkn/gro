import {printSpawnResult, spawn, type SpawnResult} from '@feltcoop/felt/util/process.js';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {printCommandArgs, serializeArgs, toForwardedArgs, type ArgsSchema} from './utils/args.js';
import {sveltekitSync} from './utils/sveltekit.js';
import {toVocabSchema} from './utils/schema.js';

const Args = z
	.object({
		tsconfig: z.string({description: 'path to tsconfig.json'}).default('tsconfig.json'),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'typecheck the project without emitting any files',
	Args,
	args: toVocabSchema(Args, 'TypecheckTaskArgs') as ArgsSchema,
	run: async ({fs, args, log}): Promise<void> => {
		const {tsconfig} = args;

		await sveltekitSync(fs);

		const forwardedTscArgs = toForwardedArgs('tsc');
		if (!forwardedTscArgs.noEmit) forwardedTscArgs.noEmit = true;
		const serializedTscArgs = ['tsc', ...serializeArgs(forwardedTscArgs)];
		log.info(printCommandArgs(serializedTscArgs));
		const tscTypecheckResult = await spawn('npx', serializedTscArgs);

		let svelteCheckResult: SpawnResult | undefined;
		if (await fs.exists('node_modules/.bin/svelte-check')) {
			const forwardedSvelteCheckArgs = toForwardedArgs('svelte-check');
			if (!forwardedSvelteCheckArgs.tsconfig) forwardedSvelteCheckArgs.tsconfig = tsconfig;
			const serializedSvelteCheckArgs = [
				'svelte-check',
				...serializeArgs(forwardedSvelteCheckArgs),
			];
			log.info(printCommandArgs(serializedSvelteCheckArgs));
			svelteCheckResult = await spawn('npx', serializedSvelteCheckArgs);
		}

		let errorMessage = '';
		if (!tscTypecheckResult.ok) {
			errorMessage = printSpawnResult(tscTypecheckResult);
		}
		if (svelteCheckResult && !svelteCheckResult.ok) {
			if (errorMessage) errorMessage += ' ';
			errorMessage += printSpawnResult(svelteCheckResult);
		}
		if (errorMessage) {
			throw new TaskError(`Failed to typecheck. ${errorMessage}`);
		}
	},
};
