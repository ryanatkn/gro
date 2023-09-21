import {z} from 'zod';
import {spawn} from '@grogarden/util/process.js';
import {red, blue} from 'kleur/colors';
import type {WrittenConfig} from '@changesets/types';
import {readFile, writeFile} from 'node:fs/promises';

import type {Task} from './task.js';
import {exists} from './exists.js';
import {dirname} from 'node:path';

const RESTRICTED_ACCESS = 'restricted';
const PUBLIC_ACCESS = 'public';

const CHANGESET_CONFIG_PATH = './.changeset/config.json';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'the commands to pass to changeset'}).default([]),
		path: z.string({description: 'changeset config file path'}).default(CHANGESET_CONFIG_PATH),
		access: z
			.union([z.literal(RESTRICTED_ACCESS), z.literal(PUBLIC_ACCESS)], {
				description: 'changeset "access" config value, `AccessType`',
			})
			.default(PUBLIC_ACCESS),
		changelog: z
			.string({description: 'changeset "changelog" config value'})
			.default('@changesets/changelog-git'),
		install: z.boolean({description: 'dual of no-install'}).default(true),
		'no-install': z
			.boolean({description: 'opt out of npm installing the changelog package'})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'call changeset with gro patterns',
	Args,
	run: async (ctx): Promise<void> => {
		const {
			args: {_: changeset_args, path, access, changelog, install},
			log,
		} = ctx;

		const inited = await exists(path);

		if (!inited) {
			await spawn('npx', ['changeset', 'init']);

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

			if (install) {
				await spawn('npm', ['i', '-D', changelog]);
			}
		}

		await spawn('changeset', changeset_args);

		await spawn('git', ['add', dirname(CHANGESET_CONFIG_PATH)]);
	},
};

export interface ChangesetCallback {
	(config: WrittenConfig): WrittenConfig | Promise<WrittenConfig>;
}

export interface UpdateWrittenConfig {
	(path: string, cb: ChangesetCallback): Promise<boolean>;
}

// TODO refactor all of this with zod and package_json helpers - util file helper? JSON parse pluggable

export const update_changeset_config: UpdateWrittenConfig = async (path, cb) => {
	const config_contents = await load_changeset_config_contents(path);
	const config = parse_changeset_config(config_contents);

	const updated = await cb(config);

	const serialized = serialize_changeset_config(updated);

	if (serialized === config_contents) {
		return false;
	}

	await write_changeset_config(serialized);
	return true;
};

export const load_changeset_config = async (): Promise<WrittenConfig> =>
	JSON.parse(await load_changeset_config_contents(CHANGESET_CONFIG_PATH));

export const load_changeset_config_contents = (path: string): Promise<string> =>
	readFile(path, 'utf8');

export const write_changeset_config = (serialized: string): Promise<void> =>
	writeFile(CHANGESET_CONFIG_PATH, serialized);

export const serialize_changeset_config = (config: WrittenConfig): string =>
	JSON.stringify(config, null, 2) + '\n';

export const parse_changeset_config = (contents: string): WrittenConfig => JSON.parse(contents);
