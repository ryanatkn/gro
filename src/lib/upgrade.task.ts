import {spawn} from '@ryanatkn/belt/process.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {extract_deps, load_package_json, type Package_Json_Dep} from './package_json.js';
import {Git_Origin, git_pull} from './git.js';
import {spawn_cli} from './cli.js';
import {serialize_args, to_forwarded_args} from './args.js';

export const Args = z.strictInterface({
	_: z
		.array(z.string())
		.meta({description: 'names of deps to exclude from the upgrade'})
		.default([]),
	only: z
		.union([z.string(), z.array(z.string())])
		.meta({
			description: 'names of deps to include in the upgrade',
		})
		.default([])
		.transform((v) => (Array.isArray(v) ? v : [v])),
	origin: Git_Origin.describe('git origin to deploy to').default('origin'),
	force: z.boolean().meta({description: 'if true, print out the planned upgrades'}).default(false),
	pull: z.boolean().meta({description: 'dual of no-pull'}).default(true),
	'no-pull': z.boolean().meta({description: 'opt out of git pull'}).default(false),
	dry: z.boolean().meta({description: 'if true, print out the planned upgrades'}).default(false),
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'upgrade deps',
	Args,
	run: async ({args, log, config}): Promise<void> => {
		const {_, only, origin, force, pull, dry} = args;

		if (_.length && only.length) {
			throw new Task_Error('Cannot call `gro upgrade` with both rest args and --only.');
		}

		// TODO maybe a different task that pulls and does other things, like `gro ready`
		if (pull) {
			await git_pull(origin);
		}

		const package_json = load_package_json();

		const all_deps = extract_deps(package_json);

		const deps = only.length
			? all_deps.filter((d) => only.includes(d.name))
			: all_deps.filter((d) => !_.includes(d.name));

		if (only.length && only.length !== deps.length) {
			throw new Task_Error(
				`Some deps to upgrade were not found: ${only.filter((o) => !deps.find((d) => d.name === o)).join(', ')}`,
			);
		}

		const upgrade_items = to_upgrade_items(deps);

		log.info(`upgrading:`, upgrade_items.join(' '));

		const install_args = ['install'].concat(upgrade_items);
		if (dry) {
			install_args.push('--dry-run');
			log.info(`deps`, deps);
		}
		if (force) {
			install_args.push('--force');
		}
		install_args.push(...serialize_args(to_forwarded_args(config.pm_cli)));
		await spawn(config.pm_cli, install_args);

		// Sync in a new process to pick up any changes after installing, avoiding some errors.
		await spawn_cli('gro', ['sync', '--no-install']); // don't install because we do above
	},
};

const EXACT_VERSION_MATCHER = /^..*@.+/;
const CUSTOM_TAG_MATCHER = /^[\^~><=]*.+-(.+)/;

// TODO hacky and limited
// TODO probably want to pass through exact deps as well, e.g. @foo/bar@1
const to_upgrade_items = (deps: Array<Package_Json_Dep>): Array<string> =>
	deps.map((dep) => {
		if (EXACT_VERSION_MATCHER.test(dep.name)) {
			return dep.name;
		}
		const custom_tag_matches = CUSTOM_TAG_MATCHER.exec(dep.version);
		if (custom_tag_matches) {
			return dep.name + '@' + custom_tag_matches[1].split('.')[0]; // I tried adding `\.?` to the end but doesn't work and I'm being lazy so I'm just splitting
		}
		return dep.name + '@latest';
	});
