import {spawn} from '@ryanatkn/belt/process.js';
import {z} from 'zod';
import {styleText as st} from 'node:util';
import {existsSync} from 'node:fs';
import {
	Git_Branch,
	Git_Origin,
	git_check_clean_workspace,
	git_checkout,
	git_fetch,
	git_pull,
} from '@ryanatkn/belt/git.js';

import {Task_Error, type Task} from './task.ts';
import {load_package_json, parse_repo_url} from './package_json.ts';
import {find_cli, spawn_cli} from './cli.ts';
import {has_sveltekit_library} from './sveltekit_helpers.ts';
import {update_changelog} from './changelog.ts';
import {load_from_env} from './env.ts';
import {CHANGESET_CLI} from './changeset_helpers.ts';

/** @nodocs */
export const Args = z.strictObject({
	branch: Git_Branch.describe('branch to publish from').default('main'),
	origin: Git_Origin.describe('git origin to publish from').default('origin'),
	changelog: z
		.string()
		.meta({description: 'file name and path of the changelog'})
		.default('CHANGELOG.md'),
	preserve_changelog: z
		.boolean()
		.meta({
			description:
				'opt out of linkifying and formatting the changelog from @changesets/changelog-git',
		})
		.default(false),
	optional: z
		.boolean()
		.meta({description: 'exit gracefully if there are no changesets'})
		.default(false),
	dry: z
		.boolean()
		.meta({description: 'build and prepare to publish without actually publishing'})
		.default(false),
	check: z.boolean().meta({description: 'dual of no-check'}).default(true),
	'no-check': z
		.boolean()
		.meta({description: 'opt out of checking before publishing'})
		.default(false),
	build: z.boolean().meta({description: 'dual of no-build'}).default(true),
	'no-build': z.boolean().meta({description: 'opt out of building'}).default(false),
	pull: z.boolean().meta({description: 'dual of no-pull'}).default(true),
	'no-pull': z.boolean().meta({description: 'opt out of git pull'}).default(false),
	changeset_cli: z.string().meta({description: 'the changeset CLI to use'}).default(CHANGESET_CLI),
});
export type Args = z.infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: 'bump version, publish to the configured registry, and git push',
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
			log.info(st('green', 'dry run!'));
		}

		const package_json = load_package_json();

		const has_sveltekit_library_result = has_sveltekit_library(package_json);
		if (!has_sveltekit_library_result.ok) {
			throw new Task_Error(
				'Failed to find SvelteKit library: ' + has_sveltekit_library_result.message,
			);
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

		// Install packages to ensure deps are current.
		// Handles cases like branch switches where package.json changed.
		// Skip gen because it will run after version bump.
		await invoke_task('sync', {install: true, gen: false});

		// Check before proceeding, defaults to true.
		if (check) {
			await invoke_task('check', {workspace: true, sync: false});
		}

		let version!: string;
		let optional_and_version_unchanged = false;

		// Bump the version so the package.json is updated before building:
		// TODO problem here is build may fail and put us in a bad state,
		// but I don't see how we could do this to robustly
		// have the new version in the build without building twice -
		// maybe the code should catch the error and revert the version and delete the tag?
		if (dry) {
			log.info('dry run, skipping changeset version');
		} else {
			if (typeof package_json.version !== 'string') {
				throw new Task_Error('Failed to find package.json version');
			}
			const parsed_repo_url = parse_repo_url(package_json);
			if (!parsed_repo_url) {
				throw new Task_Error(
					'package.json `repository` must contain a repo url (and GitHub only for now, sorry),' +
						' like `git+https://github.com/ryanatkn/gro.git` or `https://github.com/ryanatkn/gro`' +
						' or an object with the `url` key',
				);
			}

			// This is the first line that alters the repo.

			const changeset_ersion_result = await spawn_cli(found_changeset_cli, ['version'], log);
			if (!changeset_ersion_result?.ok) {
				throw Error('changeset version failed: no commits were made: see the error above');
			}

			if (!preserve_changelog) {
				const token = load_from_env('SECRET_GITHUB_API_TOKEN');
				if (!token) {
					log.warn(
						'the env var SECRET_GITHUB_API_TOKEN was not found, so API calls with be unauthorized',
					);
				}
				await update_changelog(parsed_repo_url.owner, parsed_repo_url.repo, changelog, token, log);
			}

			// Regenerate files that depend on package.json version.
			// The check above ensures gen is updated.
			await invoke_task('gen');

			const package_json_after_versioning = load_package_json();
			version = package_json_after_versioning.version!;
			if (package_json.version === version) {
				// The version didn't change.
				// For now this is the best detection we have for a no-op `changeset version`.
				if (optional) {
					optional_and_version_unchanged = true;
				} else {
					// Doesn't build if the version didn't change and publishing isn't optional.
					throw new Task_Error(`\`${changeset_cli} version\` failed: are there any changes?`);
				}
			}
		}

		// Build after the version is bumped so the new version is in the build as needed.
		// Skip sync and install because we already handled both above.
		if (build) {
			await invoke_task('build', {sync: false, install: false});
		}

		// Return early if there are no changes and publishing is optional, but after building,
		// so if callers want to optimize away building
		// they need to do so manually like in `gro release`.
		// TODO this could be cleaned up if tasks had a return value to callers, it could specifiy that it didn't build
		if (optional_and_version_unchanged) return;

		if (dry) {
			log.info('publishing branch ' + branch);
			log.info(st('green', 'dry run complete!'));
			return;
		}

		const changeset_publish_result = await spawn_cli(found_changeset_cli, ['publish'], log);
		if (!changeset_publish_result?.ok) {
			throw new Task_Error(
				`\`${changeset_cli} publish\` failed - continue manually or try again after running \`git reset --hard\``,
			);
		}

		if (!changelog_exists && existsSync(changelog)) {
			await spawn('git', ['add', changelog]);
		}
		await spawn('git', ['commit', '-a', '-m', `publish v${version}`]);
		await spawn('git', ['push', '--follow-tags']);

		log.info(st('green', `published to branch ${st('cyan', branch)}!`));
	},
};
