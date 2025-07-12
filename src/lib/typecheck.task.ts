import {print_spawn_result} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.ts';
import {serialize_args, to_forwarded_args} from './args.ts';
import {find_cli, spawn_cli, spawn_cli_process} from './cli.ts';
import {SVELTE_CHECK_CLI, sveltekit_sync_if_available} from './sveltekit_helpers.ts';
import {configure_colored_output_with_path_replacement} from './child_process_logging.ts';
import {paths} from './paths.ts';

export const Args = z
	.object({
		svelte_check_cli: z
			.string({description: 'the svelte-check CLI to use'})
			.default(SVELTE_CHECK_CLI),
		typescript_cli: z
			.string({description: 'the TypeScript CLI to use as a fallback to svelte-check'})
			.default('tsc'),
		path_replacement: z
			.string({description: 'replacement string for current working directory in output'})
			.default('.'),
		cwd: z.string({description: 'current working directory'}).default(paths.root),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run svelte-check or tsc on the project without emitting any files',
	Args,
	run: async ({args, log}): Promise<void> => {
		const {svelte_check_cli, typescript_cli, path_replacement, cwd} = args;

		await sveltekit_sync_if_available();

		// Prefer svelte-check if available.
		const found_svelte_check_cli = find_cli(svelte_check_cli);
		if (found_svelte_check_cli) {
			const serialized = serialize_args(to_forwarded_args(svelte_check_cli));
			const spawned = spawn_cli_process(found_svelte_check_cli, serialized, undefined, {
				stdio: ['inherit', 'pipe', 'pipe'],
				env: {...process.env, FORCE_COLOR: '1'}, // Needed for colors (maybe make an option)
			});

			const svelte_check_process = spawned?.child;
			if (svelte_check_process) {
				// Configure process output with path replacement while preserving colors
				configure_colored_output_with_path_replacement(svelte_check_process, path_replacement, cwd);

				const svelte_check_result = await spawned.closed;

				if (!svelte_check_result.ok) {
					throw new Task_Error(`Failed to typecheck. ${print_spawn_result(svelte_check_result)}`);
				}
			}

			return;
		}

		// Fall back to tsc.
		const found_typescript_cli = find_cli(typescript_cli);
		if (found_typescript_cli) {
			const forwarded = to_forwarded_args(typescript_cli);
			if (!forwarded.noEmit) forwarded.noEmit = true;
			const serialized = serialize_args(forwarded);
			const svelte_check_result = await spawn_cli(found_typescript_cli, serialized, log);
			if (!svelte_check_result?.ok) {
				throw new Task_Error(`Failed to typecheck. ${print_spawn_result(svelte_check_result!)}`);
			}
			return;
		}

		throw new Task_Error(
			`Failed to typecheck because neither \`${svelte_check_cli}\` nor \`${typescript_cli}\` was found`,
		);
	},
};
