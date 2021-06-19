import {join} from 'path';
import {spawn_process} from '@feltcoop/felt/util/process.js';
import {print_error} from '@feltcoop/felt/util/print.js';
import {magenta, green, rainbow, red} from '@feltcoop/felt/util/terminal.js';

import type {Task} from './task/task.js';
import {GIT_DIRNAME, paths, print_path, SVELTEKIT_DIST_DIRNAME} from './paths.js';
import {GIT_DEPLOY_BRANCH} from './build/default_build_config.js';
import {clean} from './fs/clean.js';

// docs at ./docs/deploy.md

// TODO there's a bug where sometimes you have to run `gro deploy` twice.. hm
// TODO support other kinds of deployments
// TODO add a flag to delete the existing deployment branch to avoid bloat (and maybe run `git gc --auto`)

// terminal command to clean up while live testing:
// gro deploy --clean && gro clean -b && gb -D deploy && git push origin :deploy

export interface Task_Args {
	dirname?: string; // defaults to `'svelte-kit'` if it exists
	branch?: string; // optional branch to deploy from; defaults to 'main'
	dry?: boolean;
	clean?: boolean; // instead of deploying, just clean the git worktree and Gro cache
}

// TODO customize
const DIST_DIR = paths.dist;
const WORKTREE_DIRNAME = 'worktree';
const WORKTREE_DIR = `${paths.root}${WORKTREE_DIRNAME}`;
const DEPLOY_BRANCH = 'deploy';
const ORIGIN = 'origin';
const INITIAL_FILE = 'package.json'; // this is a single file that's copied into the new branch to bootstrap it
const TEMP_PREFIX = '__TEMP__';
const GIT_ARGS = {cwd: WORKTREE_DIR};

export const task: Task<Task_Args> = {
	summary: 'deploy to static hosting',
	dev: false,
	run: async ({fs, invoke_task, args, log, dev}): Promise<void> => {
		const {branch, dry, clean: clean_and_exit} = args;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}

		const source_branch = branch || GIT_DEPLOY_BRANCH;

		// TODO how to get the deployed build? config property? infer if there's a SvelteKit one and no config?
		const dirname = args.dirname || SVELTEKIT_DIST_DIRNAME;
		const dir = `${DIST_DIR}${dirname}`;

		// Exit early if the git working directory has any unstaged or staged changes.
		// unstaged changes: `git diff --exit-code`
		// staged uncommitted changes: `git diff --exit-code --cached`
		const git_diff_unstaged_result = await spawn_process('git', ['diff', '--exit-code', '--quiet']);
		if (!git_diff_unstaged_result.ok) {
			log.error(red('git has unstaged changes: please commit or stash to proceed'));
			return;
		}
		const git_diff_staged_result = await spawn_process('git', [
			'diff',
			'--exit-code',
			'--cached',
			'--quiet',
		]);
		if (!git_diff_staged_result.ok) {
			log.error(red('git has staged but uncommitted changes: please commit or stash to proceed'));
			return;
		}

		// Ensure we're on the right branch.
		const git_checkout_result = await spawn_process('git', ['checkout', source_branch]);
		if (!git_checkout_result.ok) {
			log.error(red(`failed git checkout with exit code ${git_checkout_result.code}`));
			return;
		}

		// TODO filter stdout? `--quiet` didn't work
		// Set up the deployment branch if necessary.
		// If the `deploymentBranch` already exists, this is a no-op.
		log.info(magenta('↓↓↓↓↓↓↓'), green('ignore any errors in here'), magenta('↓↓↓↓↓↓↓'));
		await spawn_process(
			`git checkout --orphan ${DEPLOY_BRANCH} && ` +
				// TODO there's definitely a better way to do this
				`cp ${INITIAL_FILE} ${TEMP_PREFIX}${INITIAL_FILE} && ` +
				`git rm -rf . && ` +
				`mv ${TEMP_PREFIX}${INITIAL_FILE} ${INITIAL_FILE} && ` +
				`git add ${INITIAL_FILE} && ` +
				`git commit -m "setup" && git checkout ${source_branch}`,
			[],
			// this uses `shell: true` because the above is unwieldy with standard command construction
			{shell: true},
		);

		// Clean up any existing worktree.
		await clean_git_worktree();
		log.info(magenta('↑↑↑↑↑↑↑'), green('ignore any errors in here'), magenta('↑↑↑↑↑↑↑'));

		// Get ready to build from scratch.
		await clean(fs, {build_prod: true}, log);

		if (clean_and_exit) {
			log.info(rainbow('all clean'));
			return;
		}

		try {
			// Run the build.
			await invoke_task('build');

			// Make sure the expected dir exists after building.
			if (!(await fs.exists(dir))) {
				log.error(red('directory does not exist:'), dir);
				return;
			}

			// Update the initial file.
			await fs.copy(INITIAL_FILE, join(dir, INITIAL_FILE));
		} catch (err) {
			log.error(red('build failed'), 'but', green('no changes were made to git'), print_error(err));
			if (dry) {
				log.info(red('dry deploy failed:'), 'files are available in', print_path(dir));
			}
			throw Error(`Deploy safely canceled due to build failure. See the error above.`);
		}

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('dry deploy complete:'), 'files are available in', print_path(dir));
			return;
		}

		try {
			// Fetch the remote deploy branch
			await spawn_process('git', ['fetch', ORIGIN, DEPLOY_BRANCH]);
			// Set up the deployment worktree
			await spawn_process('git', ['worktree', 'add', WORKTREE_DIRNAME, DEPLOY_BRANCH]);
			// Pull the remote deploy branch, ignoring failures
			await spawn_process('git', ['pull', ORIGIN, DEPLOY_BRANCH], GIT_ARGS);
			// Populate the worktree dir with the new files.
			// We're doing this rather than copying the directory
			// because we need to preserve the existing worktree directory, or git breaks.
			// TODO there is be a better way but what is it
			await Promise.all(
				(await fs.read_dir(WORKTREE_DIR)).map((path) =>
					path === GIT_DIRNAME ? null : fs.remove(`${WORKTREE_DIR}/${path}`),
				),
			);
			await Promise.all(
				(await fs.read_dir(dir)).map((path) => fs.move(`${dir}${path}`, `${WORKTREE_DIR}/${path}`)),
			);
			// commit the changes
			await spawn_process('git', ['add', '.', '-f'], GIT_ARGS);
			await spawn_process('git', ['commit', '-m', 'deployment'], GIT_ARGS);
			await spawn_process('git', ['push', ORIGIN, DEPLOY_BRANCH, '-f'], GIT_ARGS);
		} catch (err) {
			log.error(red('updating git failed:'), print_error(err));
			await clean_git_worktree();
			throw Error(`Deploy failed in a bad state: built but not pushed. See the error above.`);
		}

		// Clean up and efficiently reconstruct dist/ for users
		await fs.remove(`${WORKTREE_DIR}/${GIT_DIRNAME}`);
		await fs.move(WORKTREE_DIR, dir, {overwrite: true});
		await clean_git_worktree();

		log.info(rainbow('deployed')); // TODO log a different message if "Everything up-to-date"
	},
};

// TODO like above, these cause some misleading logging
const clean_git_worktree = async (): Promise<void> => {
	await spawn_process('git', ['worktree', 'remove', WORKTREE_DIRNAME, '--force']);
	await spawn_process('git', ['worktree', 'prune']);
};
