import {z} from 'zod';

import type {Task} from './task.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'publish and deploy',
	Args,
	run: async ({invoke_task}) => {
		await invoke_task('publish');
		await invoke_task('deploy');
	},
};
