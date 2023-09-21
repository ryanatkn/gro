import {join} from 'node:path';
import {spawn} from '@grogarden/util/process.js';
import {print_error} from '@grogarden/util/print.js';
import {green, red} from 'kleur/colors';
import {z} from 'zod';
import {execSync} from 'node:child_process';
import {copyFile, readdir, rename, rm} from 'node:fs/promises';

import type {Task} from './task.js';
import {GIT_DIRNAME, paths, print_path, SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';

// docs at ./docs/deploy.md

// TODO use the `gro deploy -- gro build --no-install` pattern to remove the `install`/`no-install` args (needs testing, maybe a custom override for `gro ` prefixes)
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
const SOURCE_BRANCH = 'main';
const TARGET_BRANCH = 'deploy';
const DANGEROUS_BRANCHES = [SOURCE_BRANCH, 'master'];

export const Args = z
	.object({
		source: z
			.string({description: 'source branch to build and deploy from'})
			.default(SOURCE_BRANCH),
		target: z.string({description: 'target branch to deploy to'}).default(TARGET_BRANCH),
		origin: z.string({description: 'git origin to deploy to'}).default(ORIGIN),
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
			.boolean({
				description: 'opt out of npm installing before building',
			})
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

		const gitTargetExistsResult = await spawn('git', [
			'ls-remote',
			'--exit-code',
			'--heads',
			origin,
			target,
		]);
		if (gitTargetExistsResult.ok) {
			// Target branch exists on remote.

			// Fetch the remote target deploy branch.
			const gitFetchTargetResult = await spawn('git', ['fetch', origin, target]);
			if (!gitFetchTargetResult.ok) {
				log.error(
					red(`failed to fetch target branch ${target} code(${gitFetchTargetResult.code})`),
				);
				return;
			}

			// Checkout the target branch to ensure tracking.
			const gitCheckoutTargetResult = await spawn('git', ['checkout', target]);
			if (!gitCheckoutTargetResult.ok) {
				log.error(
					red(`failed to checkout target branch ${target} code(${gitCheckoutTargetResult.code})`),
				);
				return;
			}

			// Reset the target branch?
			if (reset) {
				const first_commit_hash = execSync(
					'git rev-list --max-parents=0 --abbrev-commit HEAD',
				).toString();
				await spawn('git', ['reset', '--hard', first_commit_hash]);
				await spawn('git', ['push', origin, target, '--force']);
			}
		} else if (gitTargetExistsResult.code === 2) {
			// Target branch does not exist remotely.

			// Create and checkout the target branch. Ignore eroors in case it already exists locally.
			await spawn('git', ['checkout', '-b', target]);
		} else {
			// Something went wrong.
			log.error(
				red(`failed to checkout target branch ${target} code(${gitTargetExistsResult.code})`),
			);
			return;
		}

		// Checkout the source branch to deploy.
		const gitCheckoutSourceResult = await spawn('git', ['checkout', source]);
		if (!gitCheckoutSourceResult.ok) {
			log.error(
				red(`failed to checkout source branch ${source} code(${gitCheckoutSourceResult.code})`),
			);
			return;
		}

		// Set up the deployment `target` branch if necessary.
		// If the branch already exists, this is a no-op.
		await spawn(
			`git checkout --orphan ${target} && ` +
				// TODO there's definitely a better way to do this
				`cp ${INITIAL_FILE} ${TEMP_PREFIX}${INITIAL_FILE} && ` +
				`git rm -rf . && ` +
				`mv ${TEMP_PREFIX}${INITIAL_FILE} ${INITIAL_FILE} && ` +
				`git add ${INITIAL_FILE} && ` +
				`git commit -m "setup" && git checkout ${source}`,
			[],
			{
				shell: true, // use `shell: true` because the above is unwieldy with standard command construction
				stdio: 'pipe', // silence the output
			},
		);

		// Clean up any existing worktree.
		await clean_git_worktree();

		if (clean) {
			log.info(green('all clean'));
			return;
		}

		try {
			// Run the build.
			await invoke_task('build', {install});

			// Make sure the expected dir exists after building.
			if (!(await exists(dir))) {
				log.error(red('directory to deploy does not exist after building:'), dir);
				return;
			}

			// Update the initial file.
			await copyFile(INITIAL_FILE, join(dir, INITIAL_FILE));
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
			// Set up the deployment worktree
			await spawn('git', ['worktree', 'add', WORKTREE_DIRNAME, target]);

			// Pull the remote deploy branch, ignoring failures
			await spawn('git', ['pull', origin, target], GIT_ARGS);

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
			await clean_git_worktree();
			throw Error(`Deploy failed in a bad state: built but not pushed. See the error above.`);
		}

		// Clean up and efficiently reconstruct dist/ for users
		await Promise.all([
			rm(`${WORKTREE_DIR}/${GIT_DIRNAME}`, {recursive: true}),
			rm(dir, {recursive: true}),
		]);
		await rename(WORKTREE_DIR, dir);
		await clean_git_worktree();

		log.info(green('deployed')); // TODO log a different message if "Everything up-to-date"
	},
};

// `{stdio: 'pipe'}` silences the output
const clean_git_worktree = async (): Promise<void> => {
	await spawn('git', ['worktree', 'remove', WORKTREE_DIRNAME, '--force'], {stdio: 'pipe'});
	await spawn('git', ['worktree', 'prune'], {stdio: 'pipe'});
};
