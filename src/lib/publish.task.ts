import {spawn} from '@grogarden/util/process.js';
import {z} from 'zod';
import {green, cyan} from 'kleur/colors';

import {TaskError, type Task} from './task.js';
import {load_package_json} from './package_json.js';
import {find_cli, spawn_cli} from './cli.js';
import {exists} from './exists.js';
import {is_this_project_gro} from './paths.js';

// publish.task.ts
// - usage: `gro publish patch`
// - forwards args to `npm version`: https://docs.npmjs.com/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch, configurable with `--branch`
// - syncs commits and tags to the configured main branch

export const Args = z
	.object({
		branch: z.string({description: 'branch to publish from'}).default('main'),
		changelog: z
			.string({description: 'file name and path of the changelog'})
			.default('CHANGELOG.md'),
		dry: z
			.boolean({description: 'build and prepare to publish without actually publishing'})
			.default(false),
		check: z.boolean({description: 'dual of no-check'}).default(true),
		'no-check': z
			.boolean({description: 'opt out of npm checking before publishing'})
			.default(false),
		install: z.boolean({description: 'dual of no-install'}).default(true),
		'no-install': z
			.boolean({description: 'opt out of npm installing before building'})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'bump version, publish to npm, and git push',
	Args,
	run: async ({args, log, invoke_task}): Promise<void> => {
		const {branch, changelog, dry, check, install} = args;
		if (dry) {
			log.info(green('dry run!'));
		}

		// TODO hacky, ensures Gro bootstraps itself
		if (is_this_project_gro) {
			await spawn('npm', ['run', 'build']);
		}

		const changelog_exists = await exists(changelog);

		// Ensure Changesets is installed:
		if (!(await find_cli('changeset'))) {
			log.error('changeset command not found: install @changesets/cli locally or globally');
			return;
		}

		// Make sure we're on the right branch:
		await spawn('git', ['fetch', 'origin', branch]);
		await spawn('git', ['checkout', branch]);
		await spawn('git', ['pull', 'origin', branch]);

		// Check before proceeding.
		if (check) {
			// TODO check for clean git workspace
			await invoke_task('check');
		}

		let version!: string;

		// Bump the version so the package.json is updated before building:
		// TODO problem here is build may fail and put us in a bad state,
		// but I don't see how we could do this to robustly
		// have the new version in the build without building twice
		if (dry) {
			log.info('dry run, skipping changeset version');
		} else {
			const pkgBefore = await load_package_json();
			if (typeof pkgBefore.version !== 'string') {
				throw new TaskError('failed to find package.json version');
			}

			const npmVersionResult = await spawn_cli('changeset', ['version']);
			if (!npmVersionResult?.ok) {
				throw Error('npm version failed: no commits were made: see the error above');
			}

			const pkg_after = await load_package_json();
			version = pkg_after.version!;
			if (pkgBefore.version === version) {
				throw new TaskError('changeset version failed: are there any changes?');
			}
		}

		// Build to create the final artifacts:
		await invoke_task('build', {install});

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

		if (!changelog_exists && (await exists(changelog))) {
			await spawn('git', ['add', changelog]);
		}
		await spawn('git', ['commit', '-a', '-m', `publish v${version}`]);
		await spawn('git', ['push', '--follow-tags']);

		log.info(green(`published to branch ${cyan(branch)}!`));
	},
};
