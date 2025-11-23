import {spawn} from '@ryanatkn/belt/process.js';
import {z} from 'zod';
import {Git_Origin, git_current_branch_name, git_push} from '@ryanatkn/belt/git.js';

import type {Task} from './task.ts';

/** @nodocs */
export const Args = z.strictObject({
	_: z
		.array(z.string())
		.meta({
			description: 'the git commit message, the same as git commit -m or --message',
		})
		.default([]),
	origin: Git_Origin.describe('git origin to commit to').default('origin'),
});
export type Args = z.infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: 'commit and push to a new branch',
	Args,
	run: async ({args}): Promise<void> => {
		const {
			_: [message],
			origin,
		} = args;

		const branch = await git_current_branch_name();

		await spawn('git', ['commit', '-a', '-m', message!]);
		await git_push(origin, branch, undefined, true);
	},
};
