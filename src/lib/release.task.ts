import {z} from 'zod';

import type {Task} from './task.js';
import {has_sveltekit_library, has_sveltekit_app} from './sveltekit_helpers.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'publish and deploy',
	Args,
	run: async ({invoke_task}) => {
		const publish = has_sveltekit_library().ok;
		if (publish) {
			await invoke_task('publish', {optional: true});
		}
		if (has_sveltekit_app().ok) {
			await invoke_task('deploy', {build: !publish});
		}
	},
};
