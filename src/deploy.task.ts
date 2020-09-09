import {join, basename} from 'path';

import {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';
import {copy, pathExists} from './fs/nodeFs.js';
import {paths} from './paths.js';
import {printError, printPath} from './utils/print.js';

// TODO how should this be done?
process.env.NODE_ENV = 'production';

// TODO customize
const distDirName = basename(paths.dist);
const deploymentBranch = 'gh-pages';
const deploymentStaticContentDir = join(paths.source, 'project/gh-pages/');
const initialFile = 'package.json';
const TEMP_PREFIX = '__TEMP__';

// TODO support other kinds of deployments
// TODO add a flag to delete the existing deployment branch to avoid bloat (and maybe run `git gc --auto`)

export const task: Task = {
	description: 'deploy to gh-pages',
	run: async ({invokeTask, args, log}): Promise<void> => {
		const {dry} = args;

		// Set up the deployment branch if necessary.
		// If the `deploymentBranch` already exists, this is a no-op.
		await spawnProcess(
			`git checkout --orphan ${deploymentBranch} && ` +
				`cp ${initialFile} ${TEMP_PREFIX}${initialFile} && ` +
				`git rm -rf . && ` +
				`mv ${TEMP_PREFIX}${initialFile} ${initialFile} && ` +
				`git add ${initialFile} && ` +
				'git commit -m "setup" && git checkout master',
			[],
			{shell: true},
		);

		const cleanGitWorktree = async (force = false): Promise<void> => {
			const removeCommand = ['worktree', 'remove', distDirName];
			if (force) removeCommand.push('--force');
			await spawnProcess('git', removeCommand);
			await spawnProcess('git', ['worktree', 'prune']);
		};

		// Clean up any existing worktree.
		await cleanGitWorktree();

		// Get ready to build from scratch.
		await invokeTask('clean');

		// Set up the deployment worktree in the dist directory.
		await spawnProcess('git', ['worktree', 'add', distDirName, deploymentBranch]);

		try {
			// Run the build.
			await invokeTask('build');

			// Copy everything from `src/project/gh-pages`. (like `CNAME` for GitHub custom domains)
			// If any files conflict, throw an error!
			// That should be part of the build process.
			if (await pathExists(deploymentStaticContentDir)) {
				await copy(deploymentStaticContentDir, paths.dist);
			}
			await copy(initialFile, join(paths.dist, initialFile));
		} catch (err) {
			log.error('Build failed:', printError(err));
			if (dry) {
				log.info('Dry deploy failed! Files are available in', printPath(distDirName));
			} else {
				await cleanGitWorktree(true);
			}
			throw Error(`Deploy aborted due to build failure. See the error above.`);
		}

		// At this point, `dist/` is ready to be committed and deployed!
		if (dry) {
			log.info('Dry deploy complete! Files are available in', printPath(distDirName));
		} else {
			await spawnProcess('git', ['add', '.'], {cwd: paths.dist});
			await spawnProcess('git', ['commit', '-m', 'deployment'], {
				cwd: paths.dist,
			});
			await spawnProcess('git', ['push', 'origin', deploymentBranch], {
				cwd: paths.dist,
			});

			// Clean up the worktree so it doesn't interfere with development.
			// TODO maybe add a flag to preserve these files instead of overloading `dry`?
			// or maybe just create a separate `deploy` dir to avoid problems?
			await cleanGitWorktree();
		}
	},
};
