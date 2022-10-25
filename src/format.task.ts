import {printSpawnResult} from '@feltcoop/felt/util/process.js';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {formatDirectory} from './format/formatDirectory.js';
import {paths} from './paths.js';
import type {ArgsSchema} from './utils/args.js';
import {toVocabSchema} from './utils/schema.js';

const Args = z
	.object({
		check: z
			.boolean({description: 'exit with a nonzero code if any files are unformatted'})
			.default(false),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'format source files',
	Args,
	args: toVocabSchema(Args, 'FormatTaskArgs') as ArgsSchema,
	run: async ({args, log}) => {
		const {check} = args;
		// TODO forward prettier args
		const formatResult = await formatDirectory(log, paths.source, check);
		if (!formatResult.ok) {
			throw new TaskError(
				`Failed ${check ? 'formatting check' : 'to format'}. ${printSpawnResult(formatResult)}`,
			);
		}
	},
};
