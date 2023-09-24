import {z} from 'zod';
import {spawn} from '@grogarden/util/process.js';

import type {Task} from './task.js';

export const Args = z
	.object({
		install: z.boolean({description: 'run npm install'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'inits the local project, also calls svelte-kit sync',
	Args,
	run: async ({args, invoke_task}): Promise<void> => {
		const {install} = args;

		if (install) {
			await spawn('npm', ['i'], {env: {...process.env, NODE_ENV: 'development'}});
		}

		await invoke_task('gen');

		await invoke_task('exports');
	},
};
