import {z} from 'zod';
import {spawn} from '@ryanatkn/belt/process.js';

import {Task_Error, type Task} from './task.ts';
import {sync_package_json} from './package_json.ts';
import {sveltekit_sync} from './sveltekit_helpers.ts';

/** @nodocs */
export const Args = z.strictObject({
	sveltekit: z.boolean().meta({description: 'dual of no-sveltekit'}).default(true),
	'no-sveltekit': z.boolean().meta({description: 'opt out of svelte-kit sync'}).default(false),
	package_json: z.boolean().meta({description: 'dual of no-package_json'}).default(true),
	'no-package_json': z.boolean().meta({description: 'opt out of package.json sync'}).default(false),
	gen: z.boolean().meta({description: 'dual of no-gen'}).default(true),
	'no-gen': z.boolean().meta({description: 'opt out of running gen'}).default(false),
	install: z.boolean().meta({description: 'opt into installing packages'}).default(false),
});
export type Args = z.infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: 'run `gro gen`, update `package.json`, and optionally install packages to sync up',
	Args,
	run: async ({args, invoke_task, config, log}): Promise<void> => {
		const {sveltekit, package_json, gen, install} = args;

		if (install) {
			const result = await spawn(config.pm_cli, ['install']);
			if (!result.ok) {
				throw new Task_Error(`Failed \`${config.pm_cli} install\``);
			}
		}

		if (sveltekit) {
			await sveltekit_sync(undefined, config.pm_cli);
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
