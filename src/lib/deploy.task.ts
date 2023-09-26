import {spawn} from '@grogarden/util/process.js';
import {print_error} from '@grogarden/util/print.js';
import {green, red} from 'kleur/colors';
import {z} from 'zod';
import {readdir, rename, rm} from 'node:fs/promises';

import {TaskError, type Task} from './task.js';
import {GIT_DIRNAME, print_path, SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';
import {
	WORKTREE_DIR,
	WORKTREE_DIRNAME,
	git_clean_worktree,
	git_check_clean_workspace,
	git_checkout,
	git_fetch,
	git_local_branch_exists,
	git_remote_branch_exists,
	Git_Origin,
	Git_Branch,
	git_delete_local_branch,
	git_delete_remote_branch,
	git_pull,
	git_push,
	git_push_to_create,
} from './git.js';

// docs at ./docs/deploy.md

// TODO use the `gro deploy -- gro build --no-install` pattern to remove the `install`/`no-install` args (needs testing, maybe a custom override for `gro ` prefixes)
// TODO support other kinds of deployments
// TODO add a flag to delete the existing deployment branch to avoid bloat (and maybe run `git gc --auto`)

// terminal command to clean up while live testing:
// gro deploy --clean && gro clean -b && gb -D deploy && git push origin :deploy

// TODO customize
const ORIGIN = 'origin';
const INITIAL_FILE_PATH = 'index.html';
const INITIAL_FILE_CONTENTS = '<!doctype html><html><body>init</body></html>';
const GIT_ARGS = {cwd: WORKTREE_DIR};
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
		dir: z.string({description: 'the SvelteKit build directory'}).default(SVELTEKIT_BUILD_DIRNAME),
		dry: z
			.boolean({
				description: 'build and prepare to deploy without actually deploying',
			})
			.default(false),
		clean: z
			.boolean({
				description: 'instead of building and deploying, just clean the git worktree and Gro cache',
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
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'deploy to a branch',
	Args,
	run: async ({args, log, invoke_task}): Promise<void> => {
		const {source, target, origin, dir, dry, clean, force, dangerous, reset, install} = args;

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

		// TODO BLOCK
		// const first_commit_hash = execSync(
		// 	'git rev-list --max-parents=0 --abbrev-commit HEAD',
		// ).toString();
		// await spawn('git', ['reset', '--hard', first_commit_hash]);
		// await spawn('git', ['push', origin, target, '--force']);

		// cases:
		// no local branch, no remote branch
		// no local branch, yes remote branch
		// yes local branch, no remote branch
		// yes local branch, yes remote branch
		// reset or not

		// fetch remote branch
		// create local branch
		// create remote branch
		// reset local and remote branches
		// update local branch
		// push remote branch

		if (false) {
			const error_message = await git_check_clean_workspace();
			if (error_message) throw new TaskError('Failed to deploy: ' + error_message);
		}

		const remote_target_exists = await git_remote_branch_exists(origin, target);
		const local_target_exists = await git_local_branch_exists(target);

		// prepare the target branch remotely and locally
		if (remote_target_exists) {
			// remote target branch already exists, so sync up
			await git_fetch(origin, target); // ensure the local branch is up to date
			await git_checkout(target); // ensure tracking
			await git_push(origin, target); // ensure the remote branch is up to date
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

		// local and remote branches are ready

		// Reset the target branch?
		if (reset) {
			if (await git_remote_branch_exists(origin, target)) {
				// TODO BLOCK can't do this, need to reset to first commit instead
				await git_delete_remote_branch(origin, target);
			}
			if (await git_local_branch_exists(target)) {
				await git_delete_local_branch(target);
			}
		}

		// the target branch is now ready both locally and remotely
		await git_checkout(source);

		// clean up any existing worktree
		await git_clean_worktree();

		if (clean) {
			log.info(green('all clean'));
			return;
		}

		try {
			await invoke_task('build', {install});

			// ensure the expected dir exists after building
			if (!(await exists(dir))) {
				log.error(red('directory to deploy does not exist after building:'), dir);
				return;
			}
		} catch (err) {
			log.error(red('build failed'), 'but', green('no changes were made to git'), print_error(err));
			if (dry) {
				log.info(red('dry deploy failed'));
			}
			throw Error(`Deploy safely canceled due to build failure. See the error above.`);
		}

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('dry deploy complete:'), 'files are available in', print_path(dir));
			return;
		}

		try {
			// set up the deployment worktree
			await spawn('git', ['worktree', 'add', WORKTREE_DIRNAME, target]);

			// pull the remote deploy branch, ignoring failures
			await git_pull(origin, target, GIT_ARGS); // TODO BLOCK still needed?

			// Populate the worktree dir with the new files.
			// We're doing this rather than copying the directory
			// because we need to preserve the existing worktree directory, or git breaks.
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
			await spawn('git', ['add', '.', '-f'], GIT_ARGS);
			await spawn('git', ['commit', '-m', 'deployment'], GIT_ARGS);
			await spawn('git', ['push', origin, target, '-f'], GIT_ARGS);
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
