import {z} from 'zod';
import {spawn} from '@ryanatkn/belt/process.js';
import {red, blue} from 'kleur/colors';
import type {WrittenConfig} from '@changesets/types';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {existsSync, readdirSync} from 'node:fs';

import {Task_Error, type Task} from './task.js';
import {load_package_json} from './package_json.js';
import {find_cli, spawn_cli} from './cli.js';
import {Git_Origin, git_check_fully_staged_workspace, git_push_to_create} from './git.js';
import {has_sveltekit_library} from './sveltekit_helpers.js';

const RESTRICTED_ACCESS = 'restricted';
const PUBLIC_ACCESS = 'public';

const CHANGESET_CLI = 'changeset';

const CHANGESET_DIR = '.changeset';

export const Changeset_Bump = z.enum(['patch', 'minor', 'major']);
export type Changeset_Bump = z.infer<typeof Changeset_Bump>;

export const Args = z
	.object({
		/**
		 * The optional rest args get joined with a space to form the `message`.
		 */
		_: z.array(z.string(), {description: 'the message for the changeset and commit'}).default([]),
		minor: z.boolean({description: 'bump the minor version'}).default(false),
		major: z.boolean({description: 'bump the major version'}).default(false),
		dir: z.string({description: 'changeset dir'}).default(CHANGESET_DIR),
		access: z
			.enum([RESTRICTED_ACCESS, PUBLIC_ACCESS], {
				description: `changeset 'access' config value, the default depends on package.json#private`,
			})
			.optional(),
		changelog: z
			.string({description: 'changeset "changelog" config value'})
			.default('@changesets/changelog-git'),
		install: z.boolean({description: 'dual of no-install'}).default(true),
		'no-install': z
			.boolean({description: 'opt out of npm installing the changelog package'})
			.default(false),
		origin: Git_Origin.describe('git origin to deploy to').default('origin'),
		changeset_cli: z.string({description: 'the changeset CLI to use'}).default(CHANGESET_CLI),
	})
	.strict();
export type Args = z.infer<typeof Args>;

/**
 * Calls the `changeset` CLI with some simple automations.
 * This API is designed for convenient manual usage, not clarity or normality.
 *
 * Usage:
 * - gro changeset some commit message
 * - gro changeset some commit message --minor
 * - gro changeset "some commit message" --minor
 */
export const task: Task<Args> = {
	summary: 'call changeset with gro patterns',
	Args,
	run: async (ctx): Promise<void> => {
		const {
			invoke_task,
			args: {_, minor, major, dir, access: access_arg, changelog, install, origin, changeset_cli},
			log,
		} = ctx;

		const message = _.join(' ');

		if (!message && (minor || major)) throw new Task_Error('cannot bump version without a message');
		if (minor && major) throw new Task_Error('cannot bump both minor and major');

		const bump: Changeset_Bump = minor ? 'minor' : major ? 'major' : 'patch';

		if (!(await find_cli(changeset_cli))) {
			throw new Task_Error(
				'changeset command not found: install @changesets/cli locally or globally',
			);
		}

		const package_json = await load_package_json();

		const has_sveltekit_library_result = await has_sveltekit_library(package_json);
		if (!has_sveltekit_library_result.ok) {
			throw new Task_Error(
				'Failed to find SvelteKit library: ' + has_sveltekit_library_result.message,
			);
		}

		const path = join(dir, 'config.json');

		const inited = existsSync(path);

		if (!inited) {
			await spawn_cli(changeset_cli, ['init']);

			const access = access_arg ?? package_json.private ? RESTRICTED_ACCESS : PUBLIC_ACCESS;

			const access_color = access === RESTRICTED_ACCESS ? blue : red;
			log.info('initing changeset with ' + access_color(access) + ' access');
			if (access !== RESTRICTED_ACCESS) {
				await update_changeset_config(path, (config) => {
					const updated = {...config};
					updated.access = access;
					updated.changelog = changelog;
					return updated;
				});
			}

			await spawn('git', ['add', dir]);

			if (install) {
				await spawn('npm', ['i', '-D', changelog]);
			}
		}

		// TODO small problem here where generated files don't get committed
		await invoke_task('sync'); // after the `npm i` above, and in all cases

		if (message) {
			// TODO see the helper below, simplify this to CLI flags when support is added to Changesets
			const changeset_adder = await create_changeset_adder(package_json.name, dir, message, bump);
			await spawn_cli(changeset_cli, ['add', '--empty']);
			await changeset_adder();
			if (!(await git_check_fully_staged_workspace())) {
				await spawn('git', ['commit', '-m', message]);
				await git_push_to_create(origin);
			}
		} else {
			await spawn_cli(changeset_cli);
			await spawn('git', ['add', dir]);
		}
	},
};

/**
 * TODO ideally this wouldn't exist and we'd use CLI flags, but they doesn't exist yet
 * @see https://github.com/changesets/changesets/pull/1121
 */
const create_changeset_adder = async (
	repo_name: string,
	dir: string,
	message: string,
	bump: Changeset_Bump,
) => {
	const filenames_before = readdirSync(dir);
	return async () => {
		const filenames_after = readdirSync(dir);
		const filenames_added = filenames_after.filter((p) => !filenames_before.includes(p));
		if (!filenames_added.length) {
			throw Error('expected to find a new changeset file');
		}
		if (filenames_added.length !== 1) {
			throw Error('expected to find exactly one new changeset file');
		}
		const path = join(dir, filenames_added[0]);
		const contents = create_new_changeset(repo_name, message, bump);
		await writeFile(path, contents, 'utf8');
		await spawn('git', ['add', path]);
	};
};

const create_new_changeset = (
	repo_name: string,
	message: string,
	bump: Changeset_Bump,
): string => `---
"${repo_name}": ${bump}
---

${message}
`;

interface Changeset_Callback {
	(config: WrittenConfig): WrittenConfig | Promise<WrittenConfig>;
}

interface Update_Written_Config {
	(path: string, cb: Changeset_Callback): Promise<boolean>;
}

// TODO refactor all of this with zod and package_json helpers - util file helper? JSON parse pluggable

const update_changeset_config: Update_Written_Config = async (path, cb) => {
	const config_contents = await load_changeset_config_contents(path);
	const config = parse_changeset_config(config_contents);

	const updated = await cb(config);

	const serialized = serialize_changeset_config(updated);

	if (serialized === config_contents) {
		return false;
	}

	await write_changeset_config(path, serialized);
	return true;
};

const load_changeset_config_contents = (path: string): Promise<string> => readFile(path, 'utf8');

const write_changeset_config = (path: string, serialized: string): Promise<void> =>
	writeFile(path, serialized);

const serialize_changeset_config = (config: WrittenConfig): string =>
	JSON.stringify(config, null, '\t') + '\n';

const parse_changeset_config = (contents: string): WrittenConfig => JSON.parse(contents);
