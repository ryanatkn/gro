import {Timings} from '@feltjs/util/timings.js';
import {printTimings} from '@feltjs/util/print.js';
import {z} from 'zod';
import {spawn} from '@feltjs/util/process.js';

import type {Task} from './task/task.js';
import {adapt} from './adapt/adapt.js';
import {Plugins} from './plugin/plugin.js';
import {clean_fs} from './util/clean.js';

export const Args = z
	.object({
		clean: z.boolean({description: 'read this instead of no-clean'}).optional().default(true),
		'no-clean': z
			.boolean({
				description: 'opt out of cleaning before building; warning! this may break your build!',
			})
			.optional()
			.default(false),
		install: z.boolean({description: 'read this instead of no-install'}).optional().default(true),
		'no-install': z
			.boolean({
				description: 'opt out of npm installing before building',
			})
			.optional()
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'build the project',
	Args,
	run: async (ctx): Promise<void> => {
		const {
			config,
			log,
			args: {clean, install},
		} = ctx;

		const timings = new Timings(); // TODO BLOCK belongs in ctx? then `printTimings` could be hoisted

		// TODO BLOCK gen like in dev?

		if (install) {
			await spawn('npm', ['i'], {env: {...process.env, NODE_ENV: 'development'}});
		}

		// TODO BLOCK review cleaning, might want a fully clean build every time
		// Clean in the default case, but not if the caller passes `clean=false`,
		// which is `no-watch` from the CLI.
		// This is used by `gro publish` and `gro deploy` because they call `clean_fs` themselves.
		if (clean) {
			clean_fs({dist: true}, log);
		}

		const plugins = await Plugins.create({...ctx, config, dev: false, watch: false, timings});

		await plugins.setup();
		await plugins.teardown();

		// Adapt the build to final ouputs.
		const adapters = await adapt({...ctx, timings});
		if (!adapters.length) log.info('no adapters to `adapt`');

		printTimings(timings, log);
	},
};
