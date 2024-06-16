import {z} from 'zod';
import {spawn} from '@ryanatkn/belt/process.js';

import {Task_Error, type Task} from './task.js';
import {sync_package_json} from './package_json.js';
import {sveltekit_sync} from './sveltekit_helpers.js';

export const Args = z
	.object({
		sveltekit: z.boolean({description: 'dual of no-sveltekit'}).default(true),
		'no-sveltekit': z.boolean({description: 'opt out of svelte-kit sync'}).default(false),
		package_json: z.boolean({description: 'dual of no-package_json'}).default(true),
		'no-package_json': z.boolean({description: 'opt out of package.json sync'}).default(false),
		gen: z.boolean({description: 'dual of no-gen'}).default(true),
		'no-gen': z.boolean({description: 'opt out of gen sync'}).default(false),
		install: z.boolean({description: 'run npm install'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'run `gro gen`, update `package.json`, and optionally `npm i` to sync up',
	Args,
	run: async ({args, invoke_task, config, log}): Promise<void> => {
		const {sveltekit, package_json, gen, install} = args;

		if (install) {
			const result = await spawn('npm', ['i']);
			if (!result.ok) {
				throw new Task_Error('failed npm install');
			}
		}

		if (sveltekit) {
			await sveltekit_sync();
			log.info('synced SvelteKit');
		}

		if (package_json && config.map_package_json) {
			await sync_package_json(config.map_package_json, log);
		}

		if (gen) {
			await invoke_task('gen');
		}
	},
};
