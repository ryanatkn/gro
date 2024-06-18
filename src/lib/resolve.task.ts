import {z} from 'zod';

import {TASK_FILE_SUFFIXES, type Task} from './task.js';
import {resolve_input_paths, to_input_paths} from './input_path.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'the input paths to resolve'}).default([]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run `gro gen`, update `package.json`, and optionally `npm i` to sync up',
	Args,
	run: async ({args, config, log}): Promise<void> => {
		const {_} = args;

		console.log('TODO resolve input paths: ', _);
		log.info('raw input paths:', _);

		const input_paths = to_input_paths(_);
		log.info('input paths:', input_paths);

		const {task_root_paths} = config;
		log.info('task root paths:', task_root_paths);

		// TODO BLOCK this is messy, either extract a helper or refactor, need to pair to task root paths, so a new helper?
		const resolved = await resolve_input_paths(input_paths, task_root_paths, TASK_FILE_SUFFIXES);
		console.log(`resolved`, resolved);
		// console.log(
		// 	`possible_paths_by_input_path`,
		// 	JSON.stringify(
		// 		Array.from(resolved.possible_paths_by_input_path.entries()),
		// 		null,
		// 		2,
		// 	),
		// );
	},
};
