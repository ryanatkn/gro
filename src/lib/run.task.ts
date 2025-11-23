import {z} from 'zod';
import {styleText as st} from 'node:util';
import {existsSync} from 'node:fs';

import {Task_Error, type Task} from './task.ts';
import {resolve_gro_module_path, spawn_with_loader} from './gro_helpers.ts';

// TODO maybe delete this? if misused is a security risk,
// and I'm not using it for anything that couldn't be done with Node directly atm.
// It could potentially be more useful if I keep building on the task system.

/** @nodocs */
export const Args = z.strictObject({
	_: z
		.array(z.string())
		.meta({description: 'the file path to run and other node CLI args'})
		.default([]),
});
export type Args = z.infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: 'execute a file with the loader, like `node` but works for TypeScript',
	Args,
	run: async ({args, log}) => {
		const {
			_: [path, ...argv],
		} = args;

		if (!path) {
			log.info(st('green', '\n\nUsage: ') + st('cyan', 'gro run path/to/file.ts [...node_args]\n'));
			return;
		}

		if (!existsSync(path)) {
			throw new Task_Error('Cannot find file to run at path: ' + path);
		}

		const loader_path = resolve_gro_module_path('loader.js');

		const spawned = await spawn_with_loader(loader_path, path, argv);
		if (!spawned.ok) {
			throw new Task_Error(`\`gro run ${path}\` failed with exit code ${spawned.code}`);
		}
	},
};
