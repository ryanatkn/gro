import {print_spawn_result} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {find_cli, spawn_cli} from './cli.js';
import {SVELTE_CHECK_CLI, sveltekit_sync} from './sveltekit_helpers.js';

export const Args = z
	.object({
		svelte_check_cli: z
			.string({description: 'the svelte-check CLI to use'})
			.default(SVELTE_CHECK_CLI),
		typescript_cli: z
			.string({description: 'the TypeScript CLI to use as a fallback to svelte-check'})
			.default('tsc'),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run tsc on the project without emitting any files',
	Args,
	run: async ({args, log}): Promise<void> => {
		const {svelte_check_cli, typescript_cli} = args;

		await sveltekit_sync();

		if (await find_cli(svelte_check_cli)) {
			// Prefer svelte-check if available.
			const serialized = serialize_args(to_forwarded_args(svelte_check_cli));
			log.info(print_command_args([svelte_check_cli].concat(serialized)));
			const svelte_check_result = await spawn_cli(svelte_check_cli, serialized);
			if (!svelte_check_result?.ok) {
				throw new Task_Error(`Failed to typecheck. ${print_spawn_result(svelte_check_result!)}`);
			}
		} else if (await find_cli(typescript_cli)) {
			// Fall back to tsc.
			const forwarded = to_forwarded_args(typescript_cli);
			if (!forwarded.noEmit) forwarded.noEmit = true;
			const serialized = serialize_args(forwarded);
			log.info(print_command_args([typescript_cli].concat(serialized)));
			const svelte_check_result = await spawn_cli(typescript_cli, serialized);
			if (!svelte_check_result?.ok) {
				throw new Task_Error(`Failed to typecheck. ${print_spawn_result(svelte_check_result!)}`);
			}
		} else {
			throw new Task_Error(
				`Failed to typecheck because neither \`${svelte_check_cli}\` nor \`${typescript_cli}\` was found`,
			);
		}
	},
};
