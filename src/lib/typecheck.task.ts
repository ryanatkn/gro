import {printSpawnResult} from '@feltjs/util/process.js';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from './utils/args.js';
import {sveltekitSync} from './utils/sveltekit.js';
import {findCli, spawnCli} from './utils/cli.js';

const Args = z.object({}).strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'typecheck the project without emitting any files',
	Args,
	run: async ({fs, log}): Promise<void> => {
		await sveltekitSync(fs);

		if (await findCli(fs, 'svelte-check')) {
			// svelte-check
			const serialized = serializeArgs(toForwardedArgs('svelte-check'));
			log.info(printCommandArgs(['svelte-check'].concat(serialized)));
			const svelteCheckResult = await spawnCli(fs, 'svelte-check', serialized);
			if (!svelteCheckResult?.ok) {
				throw new TaskError(`Failed to typecheck. ${printSpawnResult(svelteCheckResult!)}`);
			}
		} else {
			// tsc
			const forwarded = toForwardedArgs('tsc');
			if (!forwarded.noEmit) forwarded.noEmit = true;
			const serialized = serializeArgs(forwarded);
			log.info(printCommandArgs(['tsc'].concat(serialized)));
			const svelteCheckResult = await spawnCli(fs, 'tsc', serialized);
			if (!svelteCheckResult?.ok) {
				throw new TaskError(`Failed to typecheck. ${printSpawnResult(svelteCheckResult!)}`);
			}
		}
	},
};
