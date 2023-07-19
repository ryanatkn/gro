import {spawn} from '@feltjs/util/process.js';
import {z} from 'zod';
import {exec} from 'child_process';

import {TaskError, type Task} from './task/task.js';

const Args = z
	.object({
		_: z.array(
			z.string({description: 'the git commit message, the same as git commit -m or --message'}),
		),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'commit and push to a new branch',
	production: true,
	Args,
	run: async ({args}): Promise<void> => {
		console.log(`args`, args);
		const {_: rest} = args;

		exec('git rev-parse --abbrev-ref HEAD', async (err, stdout, stderr) => {
			console.log(`stdout`, stdout);
			if (err) throw new TaskError('error: ' + stderr);
			await spawn('git', ['commit', '-am', ...rest]);
			await spawn('git', ['push', '-u', 'origin', stdout]);
		});
	},
};
