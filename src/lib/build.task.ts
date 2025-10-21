import {z} from 'zod';
import {styleText as st} from 'node:util';
import {git_check_clean_workspace} from '@ryanatkn/belt/git.js';
import {rmSync, existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

import type {Task} from './task.ts';
import {Plugins} from './plugin.ts';
import {clean_fs} from './clean_fs.ts';
import {
	is_build_cache_valid,
	create_build_cache_metadata,
	save_build_cache_metadata,
} from './build_cache.ts';
import {GRO_DIST_PREFIX, SVELTEKIT_DIST_DIRNAME} from './constants.ts';
import {paths} from './paths.ts';

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

		// Check if workspace has uncommitted changes
		const workspace_dirty = !!(await git_check_clean_workspace());

		// Check build cache unless force_build is set or workspace is dirty
		if (!workspace_dirty && !force_build) {
			const cache_valid = await is_build_cache_valid(config, log);
			if (cache_valid) {
				log.info(
					st('cyan', 'Skipping build, cache is valid'),
					st('dim', '(use --force_build to rebuild)'),
				);
				return;
			}
		} else if (workspace_dirty) {
			// Delete cache and all distribution outputs to prevent stale state
			const cache_path = join(paths.build, 'build.json');
			if (existsSync(cache_path)) {
				rmSync(cache_path, {force: true});
			}
			// Delete dist/ directory (SvelteKit library output)
			if (existsSync(SVELTEKIT_DIST_DIRNAME)) {
				rmSync(SVELTEKIT_DIST_DIRNAME, {recursive: true, force: true});
			}
			// Delete all dist_* directories (server and other plugin outputs)
			const dist_dirs = readdirSync('.').filter((p) => p.startsWith(GRO_DIST_PREFIX));
			for (const dir of dist_dirs) {
				rmSync(dir, {recursive: true, force: true});
			}
			log.info(st('yellow', 'Workspace has uncommitted changes - skipping build cache'));
		} else {
			log.info(st('yellow', 'Forcing fresh build, ignoring cache'));
		}

		await clean_fs({build_dist: true});

		const plugins = await Plugins.create({...ctx, dev: false, watch: false});
		await plugins.setup();
		await plugins.adapt();
		await plugins.teardown();

		// Save build cache metadata after successful build (only if workspace is clean)
		if (!workspace_dirty) {
			const metadata = await create_build_cache_metadata(config, log);
			save_build_cache_metadata(metadata);
			log.debug('Build cache metadata saved');
		}
	},
};
