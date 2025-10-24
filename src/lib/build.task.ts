import {z} from 'zod';
import {styleText as st} from 'node:util';
import {git_check_clean_workspace, git_current_commit_hash} from '@ryanatkn/belt/git.js';
import {rmSync, existsSync} from 'node:fs';
import {join} from 'node:path';

import {Task_Error, type Task} from './task.ts';
import {Plugins} from './plugin.ts';
import {clean_fs} from './clean_fs.ts';
import {
	is_build_cache_valid,
	create_build_cache_metadata,
	save_build_cache_metadata,
	discover_build_output_dirs,
	hash_build_cache_config,
} from './build_cache.ts';
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

/**
 * Length of git commit hash when displayed in logs (standard git convention).
 */
export const GIT_SHORT_HASH_LENGTH = 7;

/**
 * Formats a git commit hash for display in logs.
 * Returns '[none]' if hash is null (e.g., not in a git repo).
 */
const format_commit_hash = (hash: string | null): string =>
	hash?.slice(0, GIT_SHORT_HASH_LENGTH) ?? '[none]';

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

		// Batch git calls upfront for performance (spawning processes is expensive)
		const [workspace_status, initial_commit] = await Promise.all([
			git_check_clean_workspace(),
			git_current_commit_hash(),
		]);
		const workspace_dirty = !!workspace_status;

		// Pre-compute build cache config hash (can't be batched since it's not git)
		const build_cache_config_hash = await hash_build_cache_config(config);

		// Check build cache unless force_build is set or workspace is dirty
		if (!workspace_dirty && !force_build) {
			const cache_valid = await is_build_cache_valid(
				config,
				log,
				initial_commit,
				build_cache_config_hash,
			);
			if (cache_valid) {
				log.info(
					st('cyan', 'Skipping build, cache is valid'),
					st('dim', '(use --force_build to rebuild)'),
				);
				return;
			}
		} else if (workspace_dirty) {
			// IMPORTANT: When workspace is dirty, we delete cache AND all outputs to prevent stale state.
			// Rationale: Uncommitted changes could be reverted, leaving cached outputs from reverted code.
			// This conservative approach prioritizes safety over convenience during development.
			const cache_path = join(paths.build, 'build.json');
			if (existsSync(cache_path)) {
				rmSync(cache_path, {force: true});
			}

			// Delete all build output directories
			const build_dirs = discover_build_output_dirs();
			for (const dir of build_dirs) {
				rmSync(dir, {recursive: true, force: true});
			}

			log.info(st('yellow', 'Workspace has uncommitted changes - skipping build cache'));
			// Skip clean_fs - already manually cleaned cache and all build outputs above
		} else {
			log.info(st('yellow', 'Forcing fresh build, ignoring cache'));
		}

		// Clean build outputs (skip if workspace was dirty - already cleaned manually above)
		if (!workspace_dirty) {
			await clean_fs({build_dist: true});
		}

		const plugins = await Plugins.create({...ctx, dev: false, watch: false});
		await plugins.setup();
		await plugins.adapt();
		await plugins.teardown();

		// Verify workspace didn't become dirty during build
		const final_workspace_status = await git_check_clean_workspace();
		if (final_workspace_status !== workspace_status) {
			// Workspace state changed during build - this indicates a problem
			throw new Task_Error(
				'Build process modified tracked files or created untracked files.\n\n' +
					'Git status after build:\n' +
					final_workspace_status +
					'\n\n' +
					'Builds should only write to output directories (build/, dist/, etc.).\n' +
					'This usually indicates a plugin or build step is incorrectly modifying source files.',
			);
		}

		// Save build cache metadata after successful build (only if workspace is clean)
		if (!workspace_dirty) {
			// Race condition protection: verify git commit didn't change during build
			const current_commit = await git_current_commit_hash();

			if (current_commit !== initial_commit) {
				log.warn(
					st('yellow', 'Git commit changed during build'),
					st(
						'dim',
						`(${format_commit_hash(initial_commit)} → ${format_commit_hash(current_commit)})`,
					),
					'- cache not saved',
				);
			} else {
				// Commit is stable - safe to save cache using pre-computed values
				const metadata = await create_build_cache_metadata(
					config,
					log,
					initial_commit,
					build_cache_config_hash,
				);
				save_build_cache_metadata(metadata, log);
				log.debug('Build cache metadata saved');
			}
		}
	},
};
