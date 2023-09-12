import {spawn} from '@feltjs/util/process.js';
import {z} from 'zod';
import {green, cyan} from 'kleur/colors';
import {existsSync} from 'node:fs';

import {TaskError, type Task} from './task/task.js';
import {clean_fs} from './util/clean.js';
import {is_this_project_gro} from './path/paths.js';
import {to_raw_rest_args} from './task/args.js';
import {GIT_DEPLOY_SOURCE_BRANCH} from './config/build_config_defaults.js';
import {load_package_json} from './util/package_json.js';
import {find_cli, spawn_cli} from './util/cli.js';

// publish.task.ts
// - usage: `gro publish patch`
// - forwards args to `npm version`: https://docs.npmjs.com/cli/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch, configurable with `--branch`
// - syncs commits and tags to the configured main branch

export const Args = z
	.object({
		branch: z.string({description: 'branch to publish from'}).default(GIT_DEPLOY_SOURCE_BRANCH),
		changelog: z
			.string({description: 'file name and path of the changelog'})
			.default('CHANGELOG.md'),
		dry: z
			.boolean({
				description:
					'build and prepare to publish without actually publishing, for diagnostic and testing purposes',
			})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'bump version, publish to npm, and git push',
	Args,
	run: async ({args, log, invoke_task}): Promise<void> => {
		const {branch, changelog, dry} = args;
		if (dry) {
			log.info(green('dry run!'));
		}

		const changelogExists = existsSync(changelog);
		let version!: string;

		// Ensure Changesets is installed:
		if (!find_cli('changeset')) {
			log.error('changeset command not found: install @changesets/cli locally or globally');
			return;
		}

		// Make sure we're on the right branch:
		await spawn('git', ['fetch', 'origin', branch]);
		await spawn('git', ['checkout', branch]);
		await spawn('git', ['pull', 'origin', branch]);

		// TODO BLOCK do we still need this?
		if (is_this_project_gro) {
			const buildResult = await spawn('npm', ['run', 'build']);
			if (!buildResult.ok) throw Error('Failed to build Gro');
		}

		// Check before proceeding.
		await invoke_task('check');

		// Bump the version so the package.json is updated before building:
		// TODO problem here is build may fail and put us in a bad state,
		// but I don't see how we could do this to robustly
		// have the new version in the build without building twice
		if (dry) {
			log.info('dry run, skipping changeset version');
		} else {
			const pkgBefore = load_package_json();
			if (typeof pkgBefore.version !== 'string') {
				throw new TaskError('failed to find package.json version');
			}

			const npmVersionResult = await spawn_cli('changeset', ['version']);
			if (!npmVersionResult?.ok) {
				throw Error('npm version failed: no commits were made: see the error above');
			}

			const pkgAfter = load_package_json(true);
			version = pkgAfter.version as string;
			if (pkgBefore.version === version) {
				throw new TaskError('changeset version failed: are there any changes?');
			}
		}

		// Build to create the final artifacts:
		await invoke_task('build', to_raw_rest_args()); // TODO BLOCK this args forwarding is wrong, won't pass validation

		if (dry) {
			log.info('publishing branch ' + branch);
			log.info(green('dry run complete!'));
			return;
		}

		const npmPublishResult = await spawn_cli('changeset', ['publish']);
		if (!npmPublishResult?.ok) {
			throw new TaskError(
				'changeset publish failed - revert the version tag or run it again manually',
			);
		}

		if (!changelogExists && existsSync(changelog)) {
			await spawn('git', ['add', changelog]);
		}
		await spawn('git', ['commit', '-a', '-m', `publish v${version}`]);
		await spawn('git', ['push', '--follow-tags']);

		log.info(green(`published to branch ${cyan(branch)}!`));
	},
};
