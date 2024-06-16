import {z} from 'zod';

import type {Task} from './task.js';
import {has_sveltekit_library, has_sveltekit_app} from './sveltekit_helpers.js';
import {to_forwarded_args} from './args.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'publish and deploy',
	Args,
	run: async ({invoke_task}) => {
		const should_publish = (await has_sveltekit_library()).ok;
		if (should_publish) {
			await invoke_task('publish', to_forwarded_args('gro publish'));
		}
		if ((await has_sveltekit_app()).ok) {
			await invoke_task('deploy', {...to_forwarded_args('gro deploy'), build: !should_publish});
		}
	},
};
