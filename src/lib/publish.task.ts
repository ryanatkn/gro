import {spawn} from '@ryanatkn/belt/process.js';
import {z} from 'zod';
import {green, cyan} from '@ryanatkn/belt/styletext.js';
import {existsSync} from 'node:fs';

import {Task_Error, type Task} from './task.js';
import {load_package_json, parse_repo_url} from './package_json.js';
import {find_cli, spawn_cli} from './cli.js';
import {IS_THIS_GRO} from './paths.js';
import {has_sveltekit_library} from './sveltekit_helpers.js';
import {update_changelog} from './changelog.js';
import {load_from_env} from './env.js';
import {
	Git_Branch,
	Git_Origin,
	git_check_clean_workspace,
	git_checkout,
	git_fetch,
	git_pull,
} from './git.js';
import {CHANGESET_CLI} from './changeset_helpers.js';

// publish.task.ts
// - usage: `gro publish patch`
// - forwards args to `npm version`: https://docs.npmjs.com/v6/commands/npm-version
// - runs the production build
// - publishes to npm from the `main` branch, configurable with `--branch`
// - syncs commits and tags to the configured main branch

export const Args = z
	.object({
		branch: Git_Branch.describe('branch to publish from').default('main'),
		origin: Git_Origin.describe('git origin to publish from').default('origin'),
		changelog: z
			.string({description: 'file name and path of the changelog'})
			.default('CHANGELOG.md'),
		preserve_changelog: z
			.boolean({
				description:
					'opt out of linkifying and formatting the changelog from @changesets/changelog-git',
			})
			.default(false),
		optional: z.boolean({description: 'exit gracefully if there are no changesets'}).default(false),
		dry: z
			.boolean({description: 'build and prepare to publish without actually publishing'})
			.default(false),
		check: z.boolean({description: 'dual of no-check'}).default(true),
		'no-check': z
			.boolean({description: 'opt out of npm checking before publishing'})
			.default(false),
		build: z.boolean({description: 'dual of no-build'}).default(true),
		'no-build': z.boolean({description: 'opt out of building'}).default(false),
		pull: z.boolean({description: 'dual of no-pull'}).default(true),
		'no-pull': z.boolean({description: 'opt out of git pull'}).default(false),
		changeset_cli: z.string({description: 'the changeset CLI to use'}).default(CHANGESET_CLI),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'bump version, publish to npm, and git push',
	Args,
	run: async ({args, log, invoke_task}): Promise<void> => {
		const {
			branch,
			origin,
			changelog,
			preserve_changelog,
			dry,
			check,
			build,
			pull,
			optional,
			changeset_cli,
		} = args;
		if (dry) {
			log.info(green('dry run!'));
		}

		const has_sveltekit_library_result = await has_sveltekit_library();
		if (!has_sveltekit_library_result.ok) {
			throw new Task_Error(
				'Failed to find SvelteKit library: ' + has_sveltekit_library_result.message,
			);
		}

		// TODO hacky, ensures Gro bootstraps itself
		if (IS_THIS_GRO) {
			await spawn('npm', ['run', 'build']);
		}

		const changelog_exists = existsSync(changelog);

		const found_changeset_cli = find_cli(changeset_cli);
		if (!found_changeset_cli) {
			throw new Task_Error(
				'changeset command not found, install @changesets/cli locally or globally',
			);
		}

		// Make sure we're on the right branch:
		await git_fetch(origin, branch);
		await git_checkout(branch);
		if (pull) {
			if (await git_check_clean_workspace()) {
				throw new Task_Error('The git workspace is not clean, pass --no-pull to bypass git pull');
			}
			await git_pull(origin, branch);
		}

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
				throw new Task_Error('Failed to find package.json version');
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

			const npmVersionResult = await spawn_cli(found_changeset_cli, ['version'], log);
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
				// The version didn't change.
				// For now this is the best detection we have for a no-op `changeset version`.
				if (optional) {
					return; // exit gracefully
				} else {
					throw new Task_Error(`\`${changeset_cli} version\` failed: are there any changes?`);
				}
			}
		}

		if (build) {
			await invoke_task('build');
		}

		if (dry) {
			log.info('publishing branch ' + branch);
			log.info(green('dry run complete!'));
			return;
		}

		const npm_publish_result = await spawn_cli(found_changeset_cli, ['publish'], log);
		if (!npm_publish_result?.ok) {
			throw new Task_Error(
				`\`${changeset_cli} publish\` failed - revert the version tag or run it again manually`,
			);
		}

		if (!changelog_exists && existsSync(changelog)) {
			await spawn('git', ['add', changelog]);
		}
		await spawn('git', ['commit', '-a', '-m', `publish v${version}`]);
		await spawn('git', ['push', '--follow-tags']);

		log.info(green(`published to branch ${cyan(branch)}!`));
	},
};
