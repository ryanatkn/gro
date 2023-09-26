import {print_spawn_result} from '@grogarden/util/process.js';
import {z} from 'zod';

import {TaskError, type Task} from './task.js';
import {format_directory} from './format_directory.js';
import {paths} from './paths.js';

export const Args = z
	.object({
		check: z
			.boolean({description: 'exit with a nonzero code if any files are unformatted'})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'format source files',
	Args,
	run: async ({args, log}) => {
		const {check} = args;
		// TODO forward prettier args
		const format_result = await format_directory(log, paths.source, check);
		if (!format_result.ok) {
			throw new TaskError(
				`Failed ${check ? 'formatting check' : 'to format'}. ${print_spawn_result(format_result)}`,
			);
		}
	},
};
