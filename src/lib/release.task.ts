import {z} from 'zod';

import type {Task} from './task.js';
import {has_library} from './gro_plugin_library.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'publish and deploy',
	Args,
	run: async ({invoke_task}) => {
		if (await has_library()) {
			await invoke_task('publish');
		}
		await invoke_task('deploy');
	},
};
