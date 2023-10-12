import {z} from 'zod';
import {spawn} from '@grogarden/util/process.js';

import type {Task} from './task.js';
import {load_package_json} from './package_json.js';

export const Args = z
	.object({
		install: z.boolean({description: 'run npm install'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run `gro gen`, update `package.json`, and optionally `npm i` to sync up',
	Args,
	run: async ({args, invoke_task}): Promise<void> => {
		const {install} = args;

		// `invoke.ts` always calls `svelte-kit sync` so no need here

		if (install) {
			await spawn('npm', ['i']);
		}

		await invoke_task('gen');

		// run `config.package_json` and check for updates
		// TODO BLOCK this is weird API
		await load_package_json();
	},
};
