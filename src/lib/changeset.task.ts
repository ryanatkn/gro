import {z} from 'zod';
import {spawn} from '@feltjs/util/process.js';
import {red, blue} from 'kleur/colors';
import type {Config as ChangesetConfig} from '@changesets/types';
import {readFile, writeFile} from 'node:fs/promises';

import type {Task} from './task/task.js';
import {exists} from './util/exists.js';

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
			.default(RESTRICTED_ACCESS),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'call changeset with gro patterns',
	Args,
	run: async (ctx): Promise<void> => {
		const {
			args: {_: changset_args, path, access},
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
					return updated;
				});
			}
		}

		await spawn('changeset', changset_args);
	},
};

export interface ChangesetCallback {
	(config: ChangesetConfig): ChangesetConfig | Promise<ChangesetConfig>;
}

export interface UpdateChangesetConfig {
	(path: string, cb: ChangesetCallback): Promise<boolean>;
}

// TODO refactor all of this with zod and package_json helpers

export const update_changeset_config: UpdateChangesetConfig = async (path, cb) => {
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

export const load_changeset_config = async (): Promise<ChangesetConfig> =>
	JSON.parse(await load_changeset_config_contents(CHANGESET_CONFIG_PATH));

const load_changeset_config_contents = (path: string): Promise<string> => readFile(path, 'utf8');

export const write_changeset_config = (serialized: string): Promise<void> =>
	writeFile(CHANGESET_CONFIG_PATH, serialized);

export const serialize_changeset_config = (config: ChangesetConfig): string =>
	JSON.stringify(config, null, 2) + '\n';

export const parse_changeset_config = (contents: string): ChangesetConfig => JSON.parse(contents);
