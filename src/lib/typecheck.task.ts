import {printSpawnResult} from '@feltjs/util/process.js';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {print_command_args, serialize_args, to_forwarded_args} from './task/args.js';
import {find_cli, spawn_cli} from './util/cli.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tsc on the project without emitting any files',
	Args,
	run: async ({log}): Promise<void> => {
		if (find_cli('svelte-check')) {
			// svelte-check
			const serialized = serialize_args(to_forwarded_args('svelte-check'));
			log.info(print_command_args(['svelte-check'].concat(serialized)));
			const svelteCheckResult = await spawn_cli('svelte-check', serialized);
			if (!svelteCheckResult?.ok) {
				throw new TaskError(`Failed to typecheck. ${printSpawnResult(svelteCheckResult!)}`);
			}
		} else {
			// tsc
			const forwarded = to_forwarded_args('tsc');
			if (!forwarded.noEmit) forwarded.noEmit = true;
			const serialized = serialize_args(forwarded);
			log.info(print_command_args(['tsc'].concat(serialized)));
			const svelteCheckResult = await spawn_cli('tsc', serialized);
			if (!svelteCheckResult?.ok) {
				throw new TaskError(`Failed to typecheck. ${printSpawnResult(svelteCheckResult!)}`);
			}
		}
	},
};
