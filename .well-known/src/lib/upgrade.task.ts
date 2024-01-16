import {spawn} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import type {Task} from './task.js';
import {load_package_json, type Package_Json} from './package_json.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'names of deps to exclude from the upgrade'}).default([]),
		dry: z.boolean({description: 'if true, print out the planned upgrades'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'upgrade deps',
	Args,
	run: async ({args, log, invoke_task}): Promise<void> => {
		const {_, dry} = args;

		const package_json = await load_package_json();

		const deps = to_deps(package_json).filter((d) => !_.includes(d.key));

		const upgrade_items = to_upgrade_items(deps);

		if (dry) {
			log.info(`deps`, deps);
			log.info(`upgrade_items`, upgrade_items);
			return;
		}

		log.info(`upgrading:`, upgrade_items.join(' '));

		await spawn('npm', ['i'].concat(upgrade_items));

		await invoke_task('sync');
	},
};

interface Dep {
	key: string;
	value: string;
}

const to_deps = (package_json: Package_Json): Dep[] => {
	const prod_deps: Dep[] = package_json.dependencies
		? Object.entries(package_json.dependencies).map(([key, value]) => ({key, value}))
		: [];
	const dev_deps: Dep[] = package_json.devDependencies
		? Object.entries(package_json.devDependencies).map(([key, value]) => ({key, value}))
		: [];
	return prod_deps.concat(dev_deps);
};

const to_upgrade_items = (deps: Dep[]): string[] =>
	deps.map((dep) => dep.key + (dep.value.includes('-next.') ? '@next' : '@latest'));
