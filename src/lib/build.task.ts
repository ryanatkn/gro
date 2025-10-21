import {z} from 'zod';
import {styleText as st} from 'node:util';

import type {Task} from './task.ts';
import {Plugins} from './plugin.ts';
import {clean_fs} from './clean_fs.ts';
import {
	is_build_cache_valid,
	create_build_cache_metadata,
	save_build_cache_metadata,
} from './build_cache.ts';
import {SVELTEKIT_BUILD_DIRNAME} from './constants.ts';

export const Args = z.strictObject({
	sync: z.boolean().meta({description: 'dual of no-sync'}).default(true),
	'no-sync': z.boolean().meta({description: 'opt out of gro sync'}).default(false),
	install: z.boolean().meta({description: 'dual of no-install'}).default(true),
	'no-install': z // convenience, same as `gro build -- gro sync --no-install` but the latter takes precedence
		.boolean()
		.meta({description: 'opt out of installing packages before building'})
		.default(false),
	force_build: z
		.boolean()
		.meta({description: 'force a fresh build, ignoring the cache'})
		.default(false),
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'build the project',
	Args,
	run: async (ctx): Promise<void> => {
		const {args, invoke_task, log, config} = ctx;
		const {sync, install, force_build} = args;

		if (sync || install) {
			if (!sync) log.warn('sync is false but install is true, so ignoring the sync option');
			await invoke_task('sync', {install});
		}

		// TODO possibly detect if the git workspace is clean, and ask for confirmation if not,
		// because we're not doing things like `gro gen` here because that's a dev/CI concern

		const build_dir = SVELTEKIT_BUILD_DIRNAME;

		// Check build cache unless force_build is set
		if (!force_build) {
			const cache_valid = await is_build_cache_valid(config, args, build_dir, log);
			if (cache_valid) {
				log.info(
					st('cyan', 'Skipping build, cache is valid'),
					st('dim', '(use --force_build to rebuild)'),
				);
				return;
			}
		} else {
			log.info(st('yellow', 'Forcing fresh build, ignoring cache'));
		}

		await clean_fs({build_dist: true});

		const plugins = await Plugins.create({...ctx, dev: false, watch: false});
		await plugins.setup();
		await plugins.adapt();
		await plugins.teardown();

		// Save build cache metadata after successful build
		const metadata = await create_build_cache_metadata(config, args, build_dir, log);
		save_build_cache_metadata(metadata, build_dir);
		log.debug('Build cache metadata saved');
	},
};
