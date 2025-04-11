import {print_spawn_result} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {format_directory} from './format_directory.js';
import {paths} from './paths.js';

export const Args = z
	.interface({
		check: z
			.boolean({description: 'exit with a nonzero code if any files are unformatted'})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'format source files',
	Args,
	run: async ({args, log, config}) => {
		const {check} = args;
		// TODO forward prettier args
		const format_result = await format_directory(
			log,
			paths.source,
			check,
			undefined,
			undefined,
			undefined,
			config.pm_cli,
		);
		if (!format_result.ok) {
			throw new Task_Error(
				`Failed ${check ? 'formatting check' : 'to format'}. ${print_spawn_result(format_result)}`,
			);
		}
	},
};
