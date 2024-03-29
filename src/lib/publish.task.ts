import {spawn} from '@ryanatkn/belt/process.js';
import {z} from 'zod';
import {green, cyan} from 'kleur/colors';

import {Task_Error, type Task} from './task.js';
import {load_package_json, parse_repo_url} from './package_json.js';
import {find_cli, spawn_cli} from './cli.js';
import {exists} from './fs.js';
import {is_this_project_gro} from './paths.js';
import {has_sveltekit_library} from './gro_plugin_sveltekit_library.js';
import {update_changelog} from './changelog.js';
import {load_from_env} from './env.js';

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
		preserve_changelog: z
			.boolean({
				description:
					'opt out of linkifying and formatting the changelog from @changesets/changelog-git',
			})
			.default(false),
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
		const {branch, changelog, preserve_changelog, dry, check, install} = args;
		if (dry) {
			log.info(green('dry run!'));
		}

		if (!(await has_sveltekit_library())) {
			throw new Task_Error(
				'gro publish failed to detect a library, run `npm i -D @sveltejs/package` to enable it',
			);
		}

		// TODO hacky, ensures Gro bootstraps itself
		if (is_this_project_gro) {
			await spawn('npm', ['run', 'build']);
		}

		const changelog_exists = await exists(changelog);

		if (!(await find_cli('changeset'))) {
			throw new Task_Error(
				'changeset command not found: install @changesets/cli locally or globally',
			);
		}

		// Make sure we're on the right branch:
		await spawn('git', ['fetch', 'origin', branch]);
		await spawn('git', ['checkout', branch]);
		await spawn('git', ['pull', 'origin', branch]);

		// Check before proceeding.
		if (check) {
			await invoke_task('check', {workspace: true});
		}

		let version!: string;

		// Bump the version so the package.json is updated before building:
		// TODO problem here is build may fail and put us in a bad state,
		// but I don't see how we could do this to robustly
		// have the new version in the build without building twice -
		// maybe the code should catch the error and revert the version and delete the tag?
		if (dry) {
			log.info('dry run, skipping changeset version');
		} else {
			const package_json_before = await load_package_json();
			if (typeof package_json_before.version !== 'string') {
				throw new Task_Error('failed to find package.json version');
			}
			const parsed_repo_url = parse_repo_url(package_json_before);
			if (!parsed_repo_url) {
				throw new Task_Error(
					'package.json `repository` must contain a repo url (and GitHub only for now, sorry),' +
						' like `git+https://github.com/ryanatkn/gro.git` or `https://github.com/ryanatkn/gro`' +
						' or an object with the `url` key',
				);
			}

			// This is the first line that alters the repo.

			const npmVersionResult = await spawn_cli('changeset', ['version']);
			if (!npmVersionResult?.ok) {
				throw Error('npm version failed: no commits were made: see the error above');
			}

			if (!preserve_changelog) {
				const token = await load_from_env('GITHUB_TOKEN_SECRET');
				if (!token) {
					log.warn(
						'the env var GITHUB_TOKEN_SECRET was not found, so API calls with be unauthorized',
					);
				}
				await update_changelog(parsed_repo_url.owner, parsed_repo_url.repo, changelog, token, log);
			}

			const package_json_after = await load_package_json();
			version = package_json_after.version!;
			if (package_json_before.version === version) {
				throw new Task_Error('changeset version failed: are there any changes?');
			}
		}

		// Build to create the final artifacts:
		await invoke_task('build', {install});

		if (dry) {
			log.info('publishing branch ' + branch);
			log.info(green('dry run complete!'));
			return;
		}

		const npm_publish_result = await spawn_cli('changeset', ['publish']);
		if (!npm_publish_result?.ok) {
			throw new Task_Error(
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
