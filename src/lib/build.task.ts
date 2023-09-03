import {Timings} from '@feltjs/util/timings.js';
import {printTimings} from '@feltjs/util/print.js';
import {z} from 'zod';
import {spawn} from '@feltjs/util/process.js';

import type {Task} from './task/task.js';
import {loadConfig, type GroConfig} from './config/config.js';
import {adapt} from './adapt/adapt.js';
import {buildSource} from './build/buildSource.js';
import {Plugins} from './plugin/plugin.js';
import {cleanFs} from './fs/clean.js';

export interface TaskEvents {
	'build.createConfig': (config: GroConfig) => void;
}

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
		preserve: z
			.boolean({
				description:
					'keeps the production build artifacts in the cache directory instead of deleting them',
			})
			.optional()
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args, TaskEvents> = {
	summary: 'build the project',
	Args,
	run: async (ctx): Promise<void> => {
		const {
			fs,
			log,
			events,
			args: {clean, install, preserve},
		} = ctx;

		const timings = new Timings(); // TODO belongs in ctx

		if (install) {
			await spawn('npm', ['i'], {env: {...process.env, NODE_ENV: 'development'}});
		}

		// Clean in the default case, but not if the caller passes a `false` `clean` arg,
		// This is used by `gro publish` and `gro deploy` because they call `cleanFs` themselves.
		if (clean) {
			await cleanFs(fs, {buildProd: true, dist: true}, log);
		}

		// TODO delete prod builds (what about config/system tho?)

		const timingToLoadConfig = timings.start('load config');
		const config = await loadConfig(fs);
		timingToLoadConfig();
		events.emit('build.createConfig', config);

		const plugins = await Plugins.create({...ctx, config, dev: false, filer: null, timings});

		// Build everything with esbuild and Gro's `Filer` first.
		// These production artifacts are then available to all adapters.
		// There may be no builds, e.g. for SvelteKit-only frontend projects,
		// so just don't build in that case.
		if (config.builds.length) {
			const timingToBuildSource = timings.start('buildSource');
			await buildSource(fs, config, false, log);
			timingToBuildSource();
		}

		await plugins.setup();
		await plugins.teardown();

		// Adapt the build to final ouputs.
		const adapters = await adapt({...ctx, config, dev: false, timings});
		if (!adapters.length) log.info('no adapters to `adapt`');

		// Delete the production build artifacts unless the caller asks to preserve them.
		if (!preserve) {
			await cleanFs(fs, {buildProd: true}, log);
		}

		printTimings(timings, log);
	},
};
