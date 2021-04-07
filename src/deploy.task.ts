import {join, basename} from 'path';

import type {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';
import {copy, pathExists} from './fs/node.js';
import {paths, SVELTE_KIT_BUILD_PATH} from './paths.js';
import {printError, printPath} from './utils/print.js';
import {green, red} from './utils/terminal.js';
import {hasSvelteKitFrontend} from './config/defaultBuildConfig.js';

export interface TaskArgs {
	dry?: boolean;
}

// TODO customize
const distDir = paths.dist;
const distDirName = basename(distDir);
const deploymentBranch = 'deploy';
const initialFile = 'package.json'; // this is a single file that's copied into the new branch to bootstrap it
const TEMP_PREFIX = '__TEMP__';

// TODO support other kinds of deployments
// TODO add a flag to delete the existing deployment branch to avoid bloat (and maybe run `git gc --auto`)

export const task: Task<TaskArgs> = {
	description: 'deploy to gh-pages',
	run: async ({invokeTask, args, log}): Promise<void> => {
		const {dry} = args;

		// Set up the deployment branch if necessary.
		// If the `deploymentBranch` already exists, this is a no-op.
		await spawnProcess(
			`git checkout --orphan ${deploymentBranch} && ` +
				// TODO there's definitely a better way to do this
				`cp ${initialFile} ${TEMP_PREFIX}${initialFile} && ` +
				`git rm -rf . && ` +
				`mv ${TEMP_PREFIX}${initialFile} ${initialFile} && ` +
				`git add ${initialFile} && ` +
				'git commit -m "setup" && git checkout main',
			[],
			{shell: true},
		);

		// Clean up any existing worktree.
		await cleanGitWorktree();

		// Get ready to build from scratch.
		await invokeTask('clean');

		// Set up the deployment worktree in the dist directory.
		await spawnProcess('git', ['worktree', 'add', distDirName, deploymentBranch]);

		try {
			// Run the build.
			await invokeTask('build');

			// Update the initial file.
			await copy(initialFile, join(distDir, initialFile));

			if (await hasSvelteKitFrontend()) {
				await copy(SVELTE_KIT_BUILD_PATH, distDir);
			}
		} catch (err) {
			log.error(red('Build failed:'), printError(err));
			if (dry) {
				log.info(red('Dry deploy failed!'), 'Files are available in', printPath(distDirName));
			} else {
				await cleanGitWorktree(true);
			}
			throw Error(`Deploy aborted due to build failure. See the error above.`);
		}

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info(green('Dry deploy complete!'), 'Files are available in', printPath(distDirName));
			return;
		}

		try {
			// TODO wait is this `cwd` correct or vestiges of the old code?
			const gitArgs = {cwd: distDir};
			await spawnProcess('git', ['add', '.'], gitArgs);
			await spawnProcess('git', ['commit', '-m', 'deployment'], gitArgs);
			await spawnProcess('git', ['push', 'origin', deploymentBranch], gitArgs);
		} catch (err) {
			log.error(red('Updating git failed:'), printError(err));
			throw Error(
				`Deploy failed in a bad state after building but before pushing. See the error above.`,
			);
		}

		// Clean up the worktree so it doesn't interfere with development.
		// TODO maybe add a flag to preserve these files instead of overloading `dry`?
		// or maybe just create a separate `deploy` dir to avoid problems?
		await cleanGitWorktree();
	},
};

const cleanGitWorktree = async (force = false): Promise<void> => {
	const removeCommand = ['worktree', 'remove', distDirName];
	if (force) removeCommand.push('--force');
	await spawnProcess('git', removeCommand);
	await spawnProcess('git', ['worktree', 'prune']);
};
