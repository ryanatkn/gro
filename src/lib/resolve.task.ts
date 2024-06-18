import {z} from 'zod';

import type {Task} from './task.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'the input paths to resolve'}).default([]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run `gro gen`, update `package.json`, and optionally `npm i` to sync up',
	Args,
	run: async ({args, config}): Promise<void> => {
		const {_} = args;

		console.log('TODO resolve input paths: ', _, config.task_root_paths);
	},
};
