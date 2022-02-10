import {join} from 'path';
import {spawn} from '@feltcoop/felt/util/process.js';
import {printError} from '@feltcoop/felt/util/print.js';
import {magenta, green, red} from 'kleur/colors';

import {rainbow} from './utils/colors.js';
import {type Task} from './task/task.js';
import {DIST_DIR, GIT_DIRNAME, paths, printPath, SVELTEKIT_DIST_DIRNAME} from './paths.js';
import {GIT_DEPLOY_SOURCE_BRANCH, GIT_DEPLOY_TARGET_BRANCH} from './build/buildConfigDefaults.js';
import {cleanFs} from './fs/clean.js';
import {type DeployTaskArgs} from './deployTask.js';
import {DeployTaskArgsSchema} from './deployTask.schema.js';

// docs at ./docs/deploy.md

// TODO there's a bug where sometimes you have to run `gro deploy` twice.. hm
// TODO support other kinds of deployments
// TODO add a flag to delete the existing deployment branch to avoid bloat (and maybe run `git gc --auto`)

// terminal command to clean up while live testing:
// gro deploy --clean && gro clean -b && gb -D deploy && git push origin :deploy

// TODO customize
const WORKTREE_DIRNAME = 'worktree';
const WORKTREE_DIR = `${paths.root}${WORKTREE_DIRNAME}`;
const ORIGIN = 'origin';
const INITIAL_FILE = 'package.json'; // this is a single file that's copied into the new branch to bootstrap it
const TEMP_PREFIX = '__TEMP__';
const GIT_ARGS = {cwd: WORKTREE_DIR};

const EXCLUDED_BRANCHES = ['main', 'master'];

export const task: Task<DeployTaskArgs> = {
	summary: 'deploy to static hosting',
	production: true,
	args: DeployTaskArgsSchema,
	run: async ({fs, args, log}): Promise<void> => {
		const {
			dirname,
			source = GIT_DEPLOY_SOURCE_BRANCH,
			target = GIT_DEPLOY_TARGET_BRANCH,
			dry = false,
			clean: cleanAndExit = false,
			force = false,
		} = args;

		if (!force && EXCLUDED_BRANCHES.includes(target)) {
			throw Error(`For safety, you cannot deploy to branch '${target}'. Pass --force to override.`);
		}

		// Exit early if the git working directory has any unstaged or staged changes.
		// unstaged changes: `git diff --exit-code`
		// staged uncommitted changes: `git diff --exit-code --cached`
		const gitDiffUnstagedResult = await spawn('git', ['diff', '--exit-code', '--quiet']);
		if (!gitDiffUnstagedResult.ok) {
			log.error(red('git has unstaged changes: please commit or stash to proceed'));
			return;
		}
		const gitDiffStagedResult = await spawn('git', ['diff', '--exit-code', '--cached', '--quiet']);
		if (!gitDiffStagedResult.ok) {
			log.error(red('git has staged but uncommitted changes: please commit or stash to proceed'));
			return;
		}

		// Ensure we're on the right branch.
		const gitCheckoutResult = await spawn('git', ['checkout', source]);
		if (!gitCheckoutResult.ok) {
			log.error(red(`failed git checkout with exit code ${gitCheckoutResult.code}`));
			return;
		}

		// TODO filter stdout? `--quiet` didn't work
		// Set up the deployment branch if necessary.
		// If the `deploymentBranch` already exists, this is a no-op.
		log.info(magenta('↓↓↓↓↓↓↓'), green('ignore any errors in here'), magenta('↓↓↓↓↓↓↓'));
		await spawn(
			`git checkout --orphan ${target} && ` +
				// TODO there's definitely a better way to do this
				`cp ${INITIAL_FILE} ${TEMP_PREFIX}${INITIAL_FILE} && ` +
				`git rm -rf . && ` +
				`mv ${TEMP_PREFIX}${INITIAL_FILE} ${INITIAL_FILE} && ` +
				`git add ${INITIAL_FILE} && ` +
				`git commit -m "setup" && git checkout ${source}`,
			[],
			// this uses `shell: true` because the above is unwieldy with standard command construction
			{shell: true},
		);

		// Clean up any existing worktree.
		await cleanGitWorktree();
		log.info(magenta('↑↑↑↑↑↑↑'), green('ignore any errors in here'), magenta('↑↑↑↑↑↑↑'));

		// Rebuild everything -- TODO maybe optimize and only clean `buildProd`
		await cleanFs(fs, {build: true, dist: true}, log);

		if (cleanAndExit) {
			log.info(rainbow('all clean'));
			return;
		}

		let dir: string;

		try {
			// Run the build.
			const buildResult = await spawn('npx', ['gro', 'build']);
			if (!buildResult.ok) throw Error('gro build failed');

			// After the build is ready, set the deployed directory, inferring as needed.
			if (dirname !== undefined) {
				dir = `${DIST_DIR}${dirname}`;
			} else if (await fs.exists(`${DIST_DIR}${SVELTEKIT_DIST_DIRNAME}`)) {
				dir = `${DIST_DIR}${SVELTEKIT_DIST_DIRNAME}`;
			} else {
				log.error(red('no dirname provided and cannot infer a default'));
				return;
			}

			// Make sure the expected dir exists after building.
			if (!(await fs.exists(dir))) {
				log.error(red('directory to deploy does not exist after building:'), dir);
				return;
			}

			// Update the initial file.
			await fs.copy(INITIAL_FILE, join(dir, INITIAL_FILE));
		} catch (err) {
			log.error(red('build failed'), 'but', green('no changes were made to git'), printError(err));
			if (dry) {
				log.info(red('dry deploy failed'));
			}
			throw Error(`Deploy safely canceled due to build failure. See the error above.`);
		}

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('dry deploy complete:'), 'files are available in', printPath(dir));
			return;
		}

		try {
			// Fetch the remote deploy branch
			await spawn('git', ['fetch', ORIGIN, target]);
			// Set up the deployment worktree
			await spawn('git', ['worktree', 'add', WORKTREE_DIRNAME, target]);
			// Pull the remote deploy branch, ignoring failures
			await spawn('git', ['pull', ORIGIN, target], GIT_ARGS);
			// Populate the worktree dir with the new files.
			// We're doing this rather than copying the directory
			// because we need to preserve the existing worktree directory, or git breaks.
			// TODO there is be a better way but what is it
			await Promise.all(
				(
					await fs.readDir(WORKTREE_DIR)
				).map((path) => (path === GIT_DIRNAME ? null : fs.remove(`${WORKTREE_DIR}/${path}`))),
			);
			await Promise.all(
				(await fs.readDir(dir)).map((path) => fs.move(`${dir}/${path}`, `${WORKTREE_DIR}/${path}`)),
			);
			// commit the changes
			await spawn('git', ['add', '.', '-f'], GIT_ARGS);
			await spawn('git', ['commit', '-m', 'deployment'], GIT_ARGS);
			await spawn('git', ['push', ORIGIN, target, '-f'], GIT_ARGS);
		} catch (err) {
			log.error(red('updating git failed:'), printError(err));
			await cleanGitWorktree();
			throw Error(`Deploy failed in a bad state: built but not pushed. See the error above.`);
		}

		// Clean up and efficiently reconstruct dist/ for users
		await fs.remove(`${WORKTREE_DIR}/${GIT_DIRNAME}`);
		await fs.move(WORKTREE_DIR, dir, {overwrite: true});
		await cleanGitWorktree();

		log.info(rainbow('deployed')); // TODO log a different message if "Everything up-to-date"
	},
};

// TODO like above, these cause some misleading logging
const cleanGitWorktree = async (): Promise<void> => {
	await spawn('git', ['worktree', 'remove', WORKTREE_DIRNAME, '--force']);
	await spawn('git', ['worktree', 'prune']);
};
