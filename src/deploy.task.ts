import {join, basename} from 'path';
import {readdirSync} from 'fs';

import type {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';
import {copy, move, remove} from './fs/node.js';
import {GIT_PATH, paths} from './paths.js';
import {printError, printPath} from './utils/print.js';
import {magenta, green, rainbow, red} from './utils/terminal.js';
import {GIT_DEPLOY_BRANCH} from './config/defaultBuildConfig.js';

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
const DIST_DIR_NAME = basename(DIST_DIR);
const WORKTREE_DIR_NAME = 'worktree';
const WORKTREE_DIR = `${paths.root}${WORKTREE_DIR_NAME}`;
const DEPLOY_BRANCH = 'deploy';
const INITIAL_FILE = 'package.json'; // this is a single file that's copied into the new branch to bootstrap it
const TEMP_PREFIX = '__TEMP__';

export const task: Task<TaskArgs> = {
	description: 'deploy to static hosting',
	dev: false,
	run: async ({invokeTask, args, log}): Promise<void> => {
		const {branch, dry, clean} = args;

		const sourceBranch = branch || GIT_DEPLOY_BRANCH;

		// Exit early if the git working directory has any unstaged or staged changes.
		const gitDiffResult = await spawnProcess('git', ['diff-index', '--quiet', 'HEAD']);
		if (!gitDiffResult.ok) {
			log.error(red('git working directory is unclean~ please commit or stash to proceed'));
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
			await copy(INITIAL_FILE, join(DIST_DIR, INITIAL_FILE));
		} catch (err) {
			log.error(red('build failed'), 'but', green('no changes were made to git'), printError(err));
			if (dry) {
				log.info(red('dry deploy failed:'), 'files are available in', printPath(DIST_DIR_NAME));
			}
			throw Error(`Deploy safely canceled due to build failure. See the error above.`);
		}

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('dry deploy complete:'), 'files are available in', printPath(DIST_DIR_NAME));
			return;
		}

		try {
			// Set up the deployment worktree in the dist directory.
			await spawnProcess('git', ['worktree', 'add', WORKTREE_DIR_NAME, DEPLOY_BRANCH]);
			// Populate the worktree dir with the new files.
			// We're doing this rather than copying the directory
			// because we need to preserve the existing worktree directory, or git breaks.
			// TODO there is be a better way but what is it
			await Promise.all(
				readdirSync(WORKTREE_DIR).map((path) =>
					path === GIT_PATH ? null : remove(`${WORKTREE_DIR}/${path}`),
				),
			);
			await Promise.all(
				readdirSync(DIST_DIR).map((path) => move(`${DIST_DIR}${path}`, `${WORKTREE_DIR}/${path}`)),
			);
			// commit the changes
			const gitArgs = {cwd: WORKTREE_DIR};
			await spawnProcess('git', ['add', '.', '-f'], gitArgs);
			await spawnProcess('git', ['commit', '-m', 'deployment'], gitArgs);
			await spawnProcess('git', ['push', 'origin', DEPLOY_BRANCH], gitArgs);
		} catch (err) {
			log.error(red('updating git failed:'), printError(err));
			await cleanGitWorktree();
			throw Error(`Deploy failed in a bad state: built but not pushed. See the error above.`);
		}

		// Clean up and efficiently reconstruct dist/ for users
		await remove(`${WORKTREE_DIR}/${GIT_PATH}`);
		await move(WORKTREE_DIR, DIST_DIR, {overwrite: true});
		await cleanGitWorktree();

		log.info(rainbow('deployed'));
	},
};

// TODO like above, these cause some misleading logging
const cleanGitWorktree = async (): Promise<void> => {
	await spawnProcess('git', ['worktree', 'remove', WORKTREE_DIR_NAME, '--force']);
	await spawnProcess('git', ['worktree', 'prune']);
};
