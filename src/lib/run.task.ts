import {z} from 'zod';
import {green, cyan} from 'kleur/colors';
import {existsSync, } from 'node:fs';

import {Task_Error, type Task} from './task.js';
import {resolve_gro_module_path, spawn_with_loader} from './gro_helpers.js';

export const Args = z
	.object({
		_: z
			.array(z.string(), {description: 'the file path to run and other node CLI args'})
			.default([]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'execute a file with the loader, like `node` but works for TypeScript',
	Args,
	run: async ({args, log}) => {
		const {
			_: [path, ...argv],
		} = args;

		if (!path) {
			log.info(green('\n\nUsage: ') + cyan('gro run path/to/file.ts [...node_args]\n'));
			return;
		}

		if (!(existsSync(path))) {
			throw new Task_Error('Cannot find file to run at path: ' + path);
		}

		const loader_path = await resolve_gro_module_path('loader.js');

		const spawned = await spawn_with_loader(loader_path, path, argv);
		if (!spawned.ok) {
			throw new Task_Error(`\`gro run ${path}\` failed with exit code ${spawned.code}`);
		}
	},
};
