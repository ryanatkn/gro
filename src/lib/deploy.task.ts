import {spawn} from '@grogarden/util/process.js';
import {print_error} from '@grogarden/util/print.js';
import {green, red} from 'kleur/colors';
import {z} from 'zod';
import {cp, readdir, rename, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';

import {Task_Error, type Task} from './task.js';
import {GIT_DIRNAME, GRO_DIRNAME, print_path, SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';
import {
	git_check_clean_workspace,
	git_checkout,
	git_fetch,
	git_local_branch_exists,
	git_remote_branch_exists,
	Git_Origin,
	Git_Branch,
	git_delete_local_branch,
	git_push,
	git_push_to_create,
	git_reset_branch_to_first_commit,
	git_pull,
} from './git.js';

// TODO BLOCK npm run build && rm -rf .gro && clear && gro deploy --dirty --source no-git-workspace --no-build

// docs at ./docs/deploy.md

// TODO use `to_forwarded_args` and the `gro deploy -- gro build --no-install` pattern to remove the `install`/`no-install` args (needs testing, maybe a custom override for `gro ` prefixes)

// terminal command to clean up while live testing:
// gro deploy --clean && gro clean -b && gb -D deploy && git push origin :deploy

// TODO customize
const cwd = process.cwd();
const ORIGIN = 'origin';
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
		origin: Git_Origin.describe('git origin to deploy to').default(ORIGIN),
		deploy_dir: z.string({description: 'the deploy output directory'}).default(DEPLOY_DIR),
		build_dir: z
			.string({description: 'the SvelteKit build directory'})
			.default(SVELTEKIT_BUILD_DIRNAME),
		dry: z
			.boolean({
				description: 'build and prepare to deploy without actually deploying',
			})
			.default(false),
		dirty: z
			.boolean({
				description: 'bypass checking that the git working directory is clean',
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
		install: z.boolean({description: 'dual of no-install'}).default(true),
		'no-install': z
			.boolean({description: 'opt out of npm installing before building'})
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
		const {
			source,
			target,
			origin,
			build_dir,
			deploy_dir,
			dry,
			dirty,
			force,
			dangerous,
			reset,
			install,
			build,
		} = args;

		if (!force && target !== TARGET_BRANCH) {
			throw Error(
				`Warning! You are deploying to a custom target branch '${target}',` +
					` instead of the default '${TARGET_BRANCH}' branch.` +
					` This will destroy your '${target}' branch!` +
					` If you understand and are OK with deleting your branch '${target}',` +
					` both locally and remotely, pass --force to suppress this error.`,
			);
		}
		if (!dangerous && DANGEROUS_BRANCHES.includes(target)) {
			throw Error(
				`Warning! You are deploying to a custom target branch '${target}'` +
					` and that appears very dangerous: it will destroy your '${target}' branch!` +
					` If you understand and are OK with deleting your branch '${target}',` +
					` both locally and remotely, pass --dangerous to suppress this error.`,
			);
		}

		const resolved_deploy_dir = resolve(deploy_dir);

		const remote_target_exists = await git_remote_branch_exists(origin, target);
		const local_target_exists = await git_local_branch_exists(target);

		// TODO BLOCK needs to handle the same complexity as below
		// Prepare the source branch
		await git_checkout(source);
		if (!dirty) {
			const clean_error_message = await git_check_clean_workspace();
			if (clean_error_message) throw new Task_Error('Failed to deploy: ' + clean_error_message);
			await git_pull(origin, source);
		}

		// Build
		try {
			if (build) {
				await invoke_task('build', {install});
			}

			// Ensure the expected dir exists after building
			if (!(await exists(build_dir))) {
				log.error(red('directory to deploy does not exist after building:'), build_dir);
				return;
			}
		} catch (err) {
			log.error(red('build failed'), 'but', green('no changes were made to git'), print_error(err));
			if (dry) {
				log.info(red('dry deploy failed'));
			}
			throw Error(`Deploy safely canceled due to build failure. See the error above.`);
		}

		// Prepare the deploy directory with the target branch
		const deploy_git_dir = join(resolved_deploy_dir, GIT_DIRNAME);
		if (!(await exists(deploy_git_dir))) {
			// Deploy directory does not exist, so initialize it
			await spawn('git', ['clone', '-b', target, '--single-branch', cwd, resolved_deploy_dir]);
		}
		await git_pull(origin, target, {cwd: resolved_deploy_dir});
		// Remove everything except .git from the deploy directory
		await Promise.all(
			(await readdir(resolved_deploy_dir)).map((path) =>
				path === GIT_DIRNAME ? null : rm(join(resolved_deploy_dir, path), {recursive: true}),
			),
		);

		// Copy the build
		await Promise.all(
			(await readdir(build_dir)).map((path) =>
				cp(join(build_dir, path), join(resolved_deploy_dir, path), {recursive: true}),
			),
		);

		// Commit and push

		console.log('gtg');
		return;

		// prepare the target branch remotely and locally
		if (remote_target_exists) {
			// remote target branch already exists, so sync up
			await git_fetch(origin, target); // ensure the local branch is up to date
			await git_checkout(target); // ensure tracking
			await git_pull(origin, target); // probably not needed
			// TODO what if push fails because it would need `--force`?
			await git_push(origin, target); // ensure the remote branch is up to date

			// local target branch is now synced with remote, but do we need to reset?
			if (reset) {
				await git_reset_branch_to_first_commit(origin, target);
			}
		} else {
			// remote target branch does not exist

			// corner case, it's probably usually better to delete the local target
			// if it doesn't exist remotely, which means we don't need to deal with `reset`
			if (local_target_exists) {
				await git_delete_local_branch(target);
			}

			// create the target branch locally and remotely
			await spawn(
				`git checkout --orphan ${target} && ` +
					// TODO there's definitely a better way to do this
					`git rm -rf . && ` +
					`echo "${INITIAL_FILE_CONTENTS}" >> ${INITIAL_FILE_PATH} && ` +
					`git add ${INITIAL_FILE_PATH} && ` +
					`git commit -m "init"`,
				[],
				// use `shell: true` because the above is unwieldy with standard command construction
				{shell: true},
			);
			await git_push_to_create(origin, target);
		}

		// the target branch is now ready both locally and remotely
		// await git_checkout(source);

		// clean up any existing worktree
		// await git_clean_worktree();

		// try {
		// 	await invoke_task('build', {install});

		// 	// ensure the expected dir exists after building
		// 	if (!(await exists(dir))) {
		// 		log.error(red('directory to deploy does not exist after building:'), dir);
		// 		return;
		// 	}
		// } catch (err) {
		// 	log.error(red('build failed'), 'but', green('no changes were made to git'), print_error(err));
		// 	if (dry) {
		// 		log.info(red('dry deploy failed'));
		// 	}
		// 	throw Error(`Deploy safely canceled due to build failure. See the error above.`);
		// }

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('dry deploy complete:'), 'files are available in', print_path(dir));
			return;
		}

		try {
			// set up the deployment worktree
			await spawn('git', ['worktree', 'add', WORKTREE_DIRNAME, target]);

			// Populate the worktree dir with the new files.
			// TODO there is be a better way but what is it
			await Promise.all(
				(await readdir(WORKTREE_DIR)).map((path) =>
					path === GIT_DIRNAME ? null : rm(`${WORKTREE_DIR}/${path}`, {recursive: true}),
				),
			);
			await Promise.all(
				(await readdir(dir)).map((path) => rename(`${dir}/${path}`, `${WORKTREE_DIR}/${path}`)),
			);

			// commit the changes
			await spawn('git', ['add', '.', '-f'], git_args);
			await spawn('git', ['commit', '-m', 'deployment'], git_args);
			await spawn('git', ['push', origin, target, '-f'], git_args);
		} catch (err) {
			log.error(red('updating git failed:'), print_error(err));
			await git_clean_worktree();
			throw Error(`Deploy failed in a bad state: built but not pushed. See the error above.`);
		}

		// Clean up and efficiently reconstruct dist/ for users
		await Promise.all([
			rm(`${WORKTREE_DIR}/${GIT_DIRNAME}`, {recursive: true}), // TODO probably a better way
			rm(dir, {recursive: true}),
		]);
		await rename(WORKTREE_DIR, dir);
		await git_clean_worktree();

		log.info(green('deployed')); // TODO log a different message if "Everything up-to-date"
	},
};
