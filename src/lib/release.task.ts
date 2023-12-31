import {z} from 'zod';

import type {Task} from './task.js';
import {has_library} from './gro_plugin_sveltekit_library.js';
import {has_sveltekit_frontend} from './gro_plugin_sveltekit_app.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'publish and deploy',
	Args,
	run: async ({invoke_task}) => {
		const publish = await has_library();
		if (publish) {
			await invoke_task('publish'); // TODO use `to_forwarded_args`
		}
		const deploy = await has_sveltekit_frontend();
		if (deploy) {
			await invoke_task('deploy', {build: !publish}); // TODO use `to_forwarded_args`
		}
	},
};
