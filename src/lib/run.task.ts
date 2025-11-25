import {z} from 'zod';
import {styleText as st} from 'node:util';
import {existsSync} from 'node:fs';

import {Task_Error, type Task} from './task.ts';
import {resolve_gro_module_path, spawn_with_loader} from './gro_helpers.ts';
import {serialize_args} from './args.ts';

/**
 * Runs a TypeScript file with Gro's loader, forwarding all args to the script.
 * Useful for scripts that need SvelteKit shims ($lib, $env, etc).
 */

/** @nodocs */
export const Args = z
	.object({
		_: z.array(z.string()).meta({description: 'the file path to run'}).default([]),
	})
	.catchall(
		z.union([
			z.string(),
			z.number(),
			z.boolean(),
			z.array(z.union([z.string(), z.number(), z.boolean()])),
		]),
	);
export type Args = z.infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: 'execute a file with the loader, like `node` but works for TypeScript',
	Args,
	run: async ({args, log}) => {
		const {_, ...forwarded_args} = args;
		const [path, ...positional_argv] = _;

		if (!path) {
			log.info(st('green', '\n\nUsage: ') + st('cyan', 'gro run path/to/file.ts [...args]\n'));
			return;
		}

		if (!existsSync(path)) {
			throw new Task_Error('Cannot find file to run at path: ' + path);
		}

		// Reconstruct argv: positional args + serialized named args
		const named_argv = serialize_args(forwarded_args);
		const full_argv = [...positional_argv, ...named_argv];

		const loader_path = resolve_gro_module_path('loader.js');

		const spawned = await spawn_with_loader(loader_path, path, full_argv);
		if (!spawned.ok) {
			throw new Task_Error(`\`gro run ${path}\` failed with exit code ${spawned.code}`);
		}
	},
};
