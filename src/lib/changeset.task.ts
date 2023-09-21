import {z} from 'zod';
import {spawn} from '@feltjs/util/process.js';

import type {Task} from './task/task.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'the commands to pass to changeset'}).default([]),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'call changeset with gro patterns',
	Args,
	run: async (ctx): Promise<void> => {
		const {
			args: {_: changet_commands},
		} = ctx;

		await spawn('changeset', changet_commands);
	},
};
