import {z} from 'zod';

import {TASK_FILE_SUFFIXES, Task_Error, type Task} from './task.js';
import {resolve_input_paths, to_input_paths} from './input_path.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'the input paths to resolve'}).default([]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'diagnostic that logs the info resolved from the filesystem for the given input paths',
	Args,
	run: async ({args, config, log}): Promise<void> => {
		const {_} = args;

		if (!_.length) {
			throw new Task_Error('No input paths provided in the `gro resolve` args');
		}

		log.info('raw input paths:', _);

		const input_paths = to_input_paths(_);
		log.info('input paths:', input_paths);

		const {task_root_paths} = config;
		log.info('task root paths:', task_root_paths);

		const {resolved_input_paths, possible_paths_by_input_path, unmapped_input_paths} =
			await resolve_input_paths(input_paths, task_root_paths, TASK_FILE_SUFFIXES);
		log.info('resolved_input_paths:', resolved_input_paths);
		log.info('possible_paths_by_input_path:', possible_paths_by_input_path);
		log.info('unmapped_input_paths:', unmapped_input_paths);
	},
};
