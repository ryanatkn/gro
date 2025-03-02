import {print_spawn_result} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {serialize_args, to_forwarded_args} from './args.js';
import {find_cli, spawn_cli, spawn_cli_process} from './cli.js';
import {SVELTE_CHECK_CLI, sveltekit_sync_if_available} from './sveltekit_helpers.js';

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

		await sveltekit_sync_if_available();

		// Prefer svelte-check if available.
		const found_svelte_check_cli = find_cli(svelte_check_cli);
		if (found_svelte_check_cli) {
			const serialized = serialize_args(to_forwarded_args(svelte_check_cli));
			const spawned = spawn_cli_process(found_svelte_check_cli, serialized, undefined, {
				stdio: ['inherit', 'pipe', 'pipe'], // TODO could maybe make a logger instead of this
			});
			const svelte_check_process = spawned?.child;
			if (svelte_check_process) {
				// TODO Store accumulated output?
				// let stdout = '';
				// let stderr = '';

				// Process stdout to filter out the current working directory
				if (svelte_check_process.stdout) {
					svelte_check_process.stdout.on('data', (data) => {
						const filtered = data.toString().replace(new RegExp(process.cwd(), 'g'), '.');
						// stdout += filtered;
						console.log(filtered); // eslint-disable-line no-console
					});
				}

				if (svelte_check_process.stderr) {
					svelte_check_process.stderr.on('data', (data) => {
						const filtered = data.toString().replace(new RegExp(process.cwd(), 'g'), '.');
						// stderr += filtered;
						console.error(filtered); // eslint-disable-line no-console
					});
				}

				const svelte_check_result = await spawned.closed;

				if (!svelte_check_result.ok) {
					throw new Task_Error(`Failed to typecheck. ${print_spawn_result(svelte_check_result)}`);
				}
			}

			type A = 13;
			const a: A = '13';

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
