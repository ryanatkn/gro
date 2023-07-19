import {spawn} from '@feltjs/util/process.js';
import {z} from 'zod';
import {execSync} from 'child_process';

import type {Task} from './task/task';

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
	run: async ({args, log}): Promise<void> => {
		console.log(`args`, args);
		const {
			_: [message],
		} = args;

		const branch = execSync('git rev-parse --abbrev-ref HEAD').toString();
		console.log(`message`, message);
		await spawn('git', ['commit', '-am', message]);
		// await spawn('git', ['push', '-u', 'origin', branch]);
	},
};
