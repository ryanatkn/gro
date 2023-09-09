import {Timings} from '@feltjs/util/timings.js';
import {printTimings} from '@feltjs/util/print.js';
import {z} from 'zod';
import {spawn} from '@feltjs/util/process.js';

import type {Task} from './task/task.js';
import {load_config, type GroConfig} from './config/config.js';
import {adapt} from './adapt/adapt.js';
import {build_source} from './build/build_source.js';
import {Plugins} from './plugin/plugin.js';
import {clean_fs} from './fs/clean.js';

export interface TaskEvents {
	'build.create_config': (config: GroConfig) => void;
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
			log,
			events,
			args: {clean, install, preserve},
		} = ctx;

		const timings = new Timings(); // TODO belongs in ctx

		if (install) {
			await spawn('npm', ['i'], {env: {...process.env, NODE_ENV: 'development'}});
		}

		// Clean in the default case, but not if the caller passes a `false` `clean` arg,
		// This is used by `gro publish` and `gro deploy` because they call `clean_fs` themselves.
		if (clean) {
			clean_fs({buildProd: true, dist: true}, log);
		}

		// TODO delete prod builds (what about config/system tho?)

		const timing_to_load_config = timings.start('load config');
		const config = await load_config();
		timing_to_load_config();
		events.emit('build.create_config', config);

		const plugins = await Plugins.create({...ctx, config, dev: false, filer: null, timings});

		// Build everything with esbuild and Gro's `Filer` first.
		// These production artifacts are then available to all adapters.
		// There may be no builds, e.g. for SvelteKit-only frontend projects,
		// so just don't build in that case.
		if (config.builds.length) {
			const timingToBuildSource = timings.start('build_source');
			await build_source(config, false, log);
			timingToBuildSource();
		}

		await plugins.setup();
		await plugins.teardown();

		// Adapt the build to final ouputs.
		const adapters = await adapt({...ctx, config, dev: false, timings});
		if (!adapters.length) log.info('no adapters to `adapt`');

		// Delete the production build artifacts at `.gro/prod` unless the caller asks to preserve them.
		// The main reason for this is to delete any imported-and-baked static environment variables,
		// which may be surprising to some users and could potentially lead to secret leaks
		// if the cache directory is mishandled. We may want to move `.gro/dist` to the root
		// so it's more visible, and so the entire `.gro` directory remains free of secrets,
		// but that may be even more error prone, because users would
		// have to gitignore a new root dist directory.
		// Dynamic variable imports can be used to avoid this problem completely.
		// For more see the SvelteKit docs - https://kit.svelte.dev/docs/modules#$env-dynamic-private
		if (!preserve) {
			clean_fs({buildProd: true}, log);
		}

		printTimings(timings, log);
	},
};
