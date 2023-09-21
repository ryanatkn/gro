import {z} from 'zod';
import {spawn} from '@feltjs/util/process.js';
import {red, blue} from 'kleur/colors';

import type {Task} from './task/task.js';
import {exists} from './util/exists.js';

const RESTRICTED_ACCESS = 'restricted';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'the commands to pass to changeset'}).default([]),
		access: z.string({description: 'changeset "access" config value'}).default(RESTRICTED_ACCESS),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'call changeset with gro patterns',
	Args,
	run: async (ctx): Promise<void> => {
		const {
			args: {_: changset_args, access},
			log,
		} = ctx;

		const inited = await exists('./.changeset/config.json');

		if (!inited) {
			await spawn('npx', ['changeset', 'init']);

			const access_color = access === RESTRICTED_ACCESS ? blue : red;
			log.info('initing changesets with ' + access_color(access) + ' access');
		}

		await spawn('changeset', changset_args);
	},
};
