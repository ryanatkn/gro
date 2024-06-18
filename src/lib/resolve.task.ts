import {z} from 'zod';

import {TASK_FILE_SUFFIX_JS, TASK_FILE_SUFFIX_TS, type Task} from './task.js';
import {get_possible_path_ids, resolve_input_paths, to_input_paths} from './input_path.js';

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

		const resolved = await resolve_input_paths(input_paths, (input_path) =>
			// TODO BLOCK this is messy, either extract a helper or refactor, need to pair to task root paths, so a new helper?
			get_possible_path_ids(
				input_path,
				[TASK_FILE_SUFFIX_TS, TASK_FILE_SUFFIX_JS],
				task_root_paths,
			),
		);
		console.log(`resolved input paths`, resolved);
	},
};
