import {spawn} from '@feltjs/util/process.js';
import {z} from 'zod';

import type {Task} from './task/task.js';
import {load_package_json, type PackageJson} from './util/package_json.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'names of deps to exclude from the upgrade'}).default([]),
		dry: z
			.boolean({description: 'if true, print out the planned upgrades'})
			.optional() // TODO behavior differs now with zod, because of `default` this does nothing
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'upgrade deps',
	Args,
	run: async ({fs, args, log}): Promise<void> => {
		const {_, dry} = args;

		const pkg = await load_package_json(fs);

		const deps = toDeps(pkg).filter((d) => !_.includes(d.key));

		const upgradeItems = toUpgradeItems(deps);

		if (dry) {
			log.info(`deps`, deps);
			log.info(`upgradeItems`, upgradeItems);
			return;
		}

		log.info(`upgrading:`, upgradeItems.join(' '));

		await spawn('npm', ['i'].concat(upgradeItems));
	},
};

interface Dep {
	key: string;
	value: string;
}

const toDeps = (pkg: PackageJson): Dep[] => {
	const prodDeps: Dep[] = pkg.dependencies
		? Object.entries(pkg.dependencies).map(([key, value]) => ({key, value}))
		: [];
	const devDeps: Dep[] = pkg.devDependencies
		? Object.entries(pkg.devDependencies).map(([key, value]) => ({key, value}))
		: [];
	return prodDeps.concat(devDeps);
};

const toUpgradeItems = (deps: Dep[]): string[] =>
	deps.map((dep) => dep.key + (dep.value.includes('-next.') ? '@next' : '@latest'));
