import {join, basename} from 'path';
import {spawnProcess} from '@feltcoop/felt/utils/process.js';
import {printError} from '@feltcoop/felt/utils/print.js';
import {magenta, green, rainbow, red} from '@feltcoop/felt/utils/terminal.js';

import type {Task} from './task/task.js';
import {GIT_DIRNAME, paths, printPath} from './paths.js';
import {GIT_DEPLOY_BRANCH} from './build/defaultBuildConfig.js';

// docs at ./docs/deploy.md

// TODO there's a bug where sometimes you have to run `gro deploy` twice.. hm
// TODO support other kinds of deployments
// TODO add a flag to delete the existing deployment branch to avoid bloat (and maybe run `git gc --auto`)

// terminal command to clean up while live testing:
// gro deploy --clean && gro clean -b && gb -D deploy && git push origin :deploy

export interface TaskArgs {
	branch?: string; // optional branch to deploy from; defaults to 'main'
	dry?: boolean;
	clean?: boolean; // clean the git worktree and Gro cache
}

// TODO customize
const DIST_DIR = paths.dist;
const DIST_DIRNAME = basename(DIST_DIR);
const WORKTREE_DIRNAME = 'worktree';
const WORKTREE_DIR = `${paths.root}${WORKTREE_DIRNAME}`;
const DEPLOY_BRANCH = 'deploy';
const ORIGIN = 'origin';
const INITIAL_FILE = 'package.json'; // this is a single file that's copied into the new branch to bootstrap it
const TEMP_PREFIX = '__TEMP__';
const GIT_ARGS = {cwd: WORKTREE_DIR};

export const task: Task<TaskArgs> = {
	description: 'deploy to static hosting',
	dev: false,
	run: async ({fs, invokeTask, args, log, dev}): Promise<void> => {
		const {branch, dry, clean} = args;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}

		const sourceBranch = branch || GIT_DEPLOY_BRANCH;

		// Exit early if the git working directory has any unstaged or staged changes.
		// unstaged changes: `git diff --exit-code`
		// staged uncommitted changes: `git diff --exit-code --cached`
		const gitDiffUnstagedResult = await spawnProcess('git', ['diff', '--exit-code', '--quiet']);
		if (!gitDiffUnstagedResult.ok) {
			log.error(red('git has unstaged changes: please commit or stash to proceed'));
			return;
		}
		const gitDiffStagedResult = await spawnProcess('git', [
			'diff',
			'--exit-code',
			'--cached',
			'--quiet',
		]);
		if (!gitDiffStagedResult.ok) {
			log.error(red('git has staged but uncommitted changes: please commit or stash to proceed'));
			return;
		}

		// Ensure we're on the right branch.
		const gitCheckoutResult = await spawnProcess('git', ['checkout', sourceBranch]);
		if (!gitCheckoutResult.ok) {
			log.error(red(`failed git checkout with exit code ${gitCheckoutResult.code}`));
			return;
		}

		// TODO filter stdout? `--quiet` didn't work
		// Set up the deployment branch if necessary.
		// If the `deploymentBranch` already exists, this is a no-op.
		log.info(magenta('↓↓↓↓↓↓↓'), green('ignore any errors in here'), magenta('↓↓↓↓↓↓↓'));
		await spawnProcess(
			`git checkout --orphan ${DEPLOY_BRANCH} && ` +
				// TODO there's definitely a better way to do this
				`cp ${INITIAL_FILE} ${TEMP_PREFIX}${INITIAL_FILE} && ` +
				`git rm -rf . && ` +
				`mv ${TEMP_PREFIX}${INITIAL_FILE} ${INITIAL_FILE} && ` +
				`git add ${INITIAL_FILE} && ` +
				`git commit -m "setup" && git checkout ${sourceBranch}`,
			[],
			// this uses `shell: true` because the above is unwieldy with standard command construction
			{shell: true},
		);

		// Clean up any existing worktree.
		await cleanGitWorktree();
		log.info(magenta('↑↑↑↑↑↑↑'), green('ignore any errors in here'), magenta('↑↑↑↑↑↑↑'));

		// Get ready to build from scratch.
		await invokeTask('clean');

		if (clean) {
			log.info(rainbow('all clean'));
			return;
		}

		try {
			// Run the build.
			await invokeTask('build');

			// Update the initial file.
			await fs.copy(INITIAL_FILE, join(DIST_DIR, INITIAL_FILE));
		} catch (err) {
			log.error(red('build failed'), 'but', green('no changes were made to git'), printError(err));
			if (dry) {
				log.info(red('dry deploy failed:'), 'files are available in', printPath(DIST_DIRNAME));
			}
			throw Error(`Deploy safely canceled due to build failure. See the error above.`);
		}

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('dry deploy complete:'), 'files are available in', printPath(DIST_DIRNAME));
			return;
		}

		try {
			// Fetch the remote deploy branch
			await spawnProcess('git', ['fetch', ORIGIN, DEPLOY_BRANCH]);
			// Set up the deployment worktree
			await spawnProcess('git', ['worktree', 'add', WORKTREE_DIRNAME, DEPLOY_BRANCH]);
			// Pull the remote deploy branch, ignoring failures
			await spawnProcess('git', ['pull', ORIGIN, DEPLOY_BRANCH], GIT_ARGS);
			// Populate the worktree dir with the new files.
			// We're doing this rather than copying the directory
			// because we need to preserve the existing worktree directory, or git breaks.
			// TODO there is be a better way but what is it
			await Promise.all(
				(await fs.readDir(WORKTREE_DIR)).map((path) =>
					path === GIT_DIRNAME ? null : fs.remove(`${WORKTREE_DIR}/${path}`),
				),
			);
			await Promise.all(
				(await fs.readDir(DIST_DIR)).map((path) =>
					fs.move(`${DIST_DIR}${path}`, `${WORKTREE_DIR}/${path}`),
				),
			);
			// commit the changes
			await spawnProcess('git', ['add', '.', '-f'], GIT_ARGS);
			await spawnProcess('git', ['commit', '-m', 'deployment'], GIT_ARGS);
			await spawnProcess('git', ['push', ORIGIN, DEPLOY_BRANCH, '-f'], GIT_ARGS);
		} catch (err) {
			log.error(red('updating git failed:'), printError(err));
			await cleanGitWorktree();
			throw Error(`Deploy failed in a bad state: built but not pushed. See the error above.`);
		}

		// Clean up and efficiently reconstruct dist/ for users
		await fs.remove(`${WORKTREE_DIR}/${GIT_DIRNAME}`);
		await fs.move(WORKTREE_DIR, DIST_DIR, {overwrite: true});
		await cleanGitWorktree();

		log.info(rainbow('deployed')); // TODO log a different message if "Everything up-to-date"
	},
};

// TODO like above, these cause some misleading logging
const cleanGitWorktree = async (): Promise<void> => {
	await spawnProcess('git', ['worktree', 'remove', WORKTREE_DIRNAME, '--force']);
	await spawnProcess('git', ['worktree', 'prune']);
};
