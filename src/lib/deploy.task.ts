import {spawn} from '@ryanatkn/belt/process.js';
import {print_error} from '@ryanatkn/belt/print.js';
import {green, red} from 'kleur/colors';
import {z} from 'zod';
import {cp, mkdir, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {existsSync, readdirSync} from 'node:fs';

import {Task_Error, type Task} from './task.js';
import {print_path} from './paths.js';
import {GRO_DIRNAME, GIT_DIRNAME, SVELTEKIT_BUILD_DIRNAME} from './path_constants.js';
import {empty_dir} from './fs.js';
import {
	git_check_clean_workspace,
	git_checkout,
	git_local_branch_exists,
	git_remote_branch_exists,
	Git_Origin,
	Git_Branch,
	git_delete_local_branch,
	git_push_to_create,
	git_reset_branch_to_first_commit,
	git_pull,
	git_fetch,
	git_check_setting_pull_rebase,
	git_clone_locally,
	git_current_branch_name,
} from './git.js';
import {escape_bash} from './cli.js';

// docs at ./docs/deploy.md

// terminal command for testing:
// npm run build && rm -rf .gro && clear && gro deploy --source no-git-workspace --no-build --dry

// TODO customize
const dir = process.cwd();
const INITIAL_FILE_PATH = '.gitkeep';
const INITIAL_FILE_CONTENTS = '';
const DEPLOY_DIR = GRO_DIRNAME + '/deploy';
const SOURCE_BRANCH = 'main';
const TARGET_BRANCH = 'deploy';
const DANGEROUS_BRANCHES = [SOURCE_BRANCH, 'master'];

export const Args = z
	.object({
		source: Git_Branch.describe('git source branch to build and deploy from').default(
			SOURCE_BRANCH,
		),
		target: Git_Branch.describe('git target branch to deploy to').default(TARGET_BRANCH),
		origin: Git_Origin.describe('git origin to deploy to').default('origin'),
		deploy_dir: z.string({description: 'the deploy output directory'}).default(DEPLOY_DIR),
		build_dir: z
			.string({description: 'the SvelteKit build directory'})
			.default(SVELTEKIT_BUILD_DIRNAME),
		dry: z
			.boolean({
				description: 'build and prepare to deploy without actually deploying',
			})
			.default(false),
		force: z
			.boolean({description: 'caution!! destroys the target branch both locally and remotely'})
			.default(false),
		dangerous: z
			.boolean({description: 'caution!! enables destruction of branches like main and master'})
			.default(false),
		reset: z
			.boolean({
				description: 'if true, resets the target branch back to the first commit before deploying',
			})
			.default(false),
		build: z.boolean({description: 'dual of no-build'}).default(true),
		'no-build': z.boolean({description: 'opt out of building'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'deploy to a branch',
	Args,
	run: async ({args, log, invoke_task}): Promise<void> => {
		const {source, target, origin, build_dir, deploy_dir, dry, force, dangerous, reset, build} =
			args;

		// Checks
		if (!force && target !== TARGET_BRANCH) {
			throw new Task_Error(
				`Warning! You are deploying to a custom target branch '${target}',` +
					` instead of the default '${TARGET_BRANCH}' branch.` +
					` This is destructive to your '${target}' branch!` +
					` If you understand and are OK with deleting your branch '${target}',` +
					` both locally and remotely, pass --force to suppress this error.`,
			);
		}
		if (!dangerous && DANGEROUS_BRANCHES.includes(target)) {
			throw new Task_Error(
				`Warning! You are deploying to a custom target branch '${target}'` +
					` and that appears very dangerous: it is destructive to your '${target}' branch!` +
					` If you understand and are OK with deleting your branch '${target}',` +
					` both locally and remotely, pass --dangerous to suppress this error.`,
			);
		}
		const clean_error_message = await git_check_clean_workspace();
		if (clean_error_message) {
			throw new Task_Error(
				'Deploy failed because the git workspace has uncommitted changes: ' + clean_error_message,
			);
		}
		if (!(await git_check_setting_pull_rebase())) {
			throw new Task_Error(
				'Deploying currently requires `git config --global pull.rebase true`,' +
					' but this restriction could be lifted with more work',
			);
		}

		// Fetch the source branch in the cwd if it's not there
		if (!(await git_local_branch_exists(source))) {
			await git_fetch(origin, source);
		}

		// Prepare the source branch in the cwd
		await git_checkout(source);
		await git_pull(origin, source);
		if (await git_check_clean_workspace()) {
			throw new Task_Error(
				'Deploy failed because the local source branch is out of sync with the remote one,' +
					' finish rebasing manually or reset with `git rebase --abort`',
			);
		}

		// Prepare the target branch remotely and locally
		const resolved_deploy_dir = resolve(deploy_dir);
		const target_spawn_options = {cwd: resolved_deploy_dir};
		const remote_target_exists = await git_remote_branch_exists(origin, target);
		if (remote_target_exists) {
			// Remote target branch already exists, so sync up efficiently

			// First, check if the deploy dir exists, and if so, attempt to sync it.
			// If anything goes wrong, delete the directory and we'll initialize it
			// using the same code path as if it didn't exist in the first place.
			if (existsSync(resolved_deploy_dir)) {
				if (target !== (await git_current_branch_name(target_spawn_options))) {
					// We're in a bad state because the target branch has changed,
					// so delete the directory and continue as if it wasn't there.
					await rm(resolved_deploy_dir, {recursive: true});
				} else {
					await spawn('git', ['reset', '--hard'], target_spawn_options); // in case it's dirty
					await git_pull(origin, target, target_spawn_options);
					if (await git_check_clean_workspace(target_spawn_options)) {
						// We're in a bad state because the local branch lost continuity with the remote,
						// so delete the directory and continue as if it wasn't there.
						await rm(resolved_deploy_dir, {recursive: true});
					}
				}
			}

			// Second, initialize the deploy dir if needed.
			// It may not exist, or it may have been deleted after failing to sync above.
			if (!existsSync(resolved_deploy_dir)) {
				const local_deploy_branch_exists = await git_local_branch_exists(target);
				await git_fetch(origin, ('+' + target + ':' + target) as Git_Branch); // fetch+merge and allow non-fastforward updates with the +
				await git_clone_locally(origin, target, dir, resolved_deploy_dir);
				// Clean up if we created the target branch in the cwd
				if (!local_deploy_branch_exists) {
					await git_delete_local_branch(target);
				}
			}

			// Local target branch is now synced with remote, but do we need to reset?
			if (reset) {
				await git_reset_branch_to_first_commit(origin, target, target_spawn_options);
			}
		} else {
			// Remote target branch does not exist, so start from scratch

			// Delete the deploy dir and recreate it
			if (existsSync(resolved_deploy_dir)) {
				await rm(resolved_deploy_dir, {recursive: true});
				await mkdir(resolved_deploy_dir, {recursive: true});
			}

			// Delete the target branch locally in the cwd if it exists
			if (await git_local_branch_exists(target)) {
				await git_delete_local_branch(target);
			}

			// Create the target branch locally and remotely.
			// This is more complex to avoid churning the cwd.
			await git_clone_locally(origin, source, dir, resolved_deploy_dir);
			await spawn('git', ['checkout', '--orphan', target], target_spawn_options);
			// TODO there's definitely a better way to do this
			await spawn('git', ['rm', '-rf', '.'], target_spawn_options);
			await spawn(
				'echo',
				[escape_bash(INITIAL_FILE_CONTENTS), '>>', INITIAL_FILE_PATH],
				target_spawn_options,
			);
			await spawn('git', ['add', INITIAL_FILE_PATH], target_spawn_options);
			await spawn('git', ['commit', '-m', 'init'], target_spawn_options);
			await git_push_to_create(origin, target, target_spawn_options);
			await git_delete_local_branch(source, target_spawn_options);
		}

		// Remove everything except .git from the deploy directory to avoid stale files
		await empty_dir(resolved_deploy_dir, (path) => path !== GIT_DIRNAME);

		// Build
		try {
			if (build) {
				await invoke_task('build');
			}
			if (!existsSync(build_dir)) {
				log.error(red('directory to deploy does not exist after building:'), build_dir);
				return;
			}
		} catch (err) {
			log.error(red('build failed'), 'but', green('no changes were made to git'), print_error(err));
			if (dry) {
				log.info(red('dry deploy failed'));
			}
			throw new Task_Error(`Deploy safely canceled due to build failure. See the error above.`);
		}

		// Copy the build
		await Promise.all(
			readdirSync(build_dir).map((path) =>
				cp(join(build_dir, path), join(resolved_deploy_dir, path), {recursive: true}),
			),
		);

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('dry deploy complete:'), 'files at', print_path(resolved_deploy_dir));
			return;
		}

		// Commit and push
		try {
			await spawn('git', ['add', '.', '-f'], target_spawn_options);
			await spawn('git', ['commit', '-m', 'deployment'], target_spawn_options);
			await spawn('git', ['push', origin, target, '-f'], target_spawn_options); // force push because we may be resetting the branch, see the checks above to make this safer
		} catch (err) {
			log.error(red('updating git failed:'), print_error(err));
			throw new Task_Error(`Deploy failed in a bad state: built but not pushed, see error above.`);
		}

		log.info(green('deployed')); // TODO log a different message if "Everything up-to-date"
	},
};
