import {spawn} from '@grogarden/util/process.js';
import {z} from 'zod';

import type {Task} from './task.js';
import {git_current_branch_name} from './git.js';

export const Args = z
	.object({
		_: z
			.array(z.string(), {
				description: 'the git commit message, the same as git commit -m or --message',
			})
			.default([]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'commit and push to a new branch',
	Args,
	run: async ({args}): Promise<void> => {
		const {
			_: [message],
		} = args;

		const branch = await git_current_branch_name();
		await spawn('git', ['commit', '-a', '-m', message]);
		await spawn(
			`git push -u origin ${branch}`,
			[],
			{shell: true}, // TODO using `shell: true` because it's failing with standard command construction - why?
		);
	},
};
