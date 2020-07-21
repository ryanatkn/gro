import {join, basename} from 'path';

import {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';
import {copy, pathExists} from './fs/nodeFs.js';
import {paths} from './paths.js';

// TODO customize?
const distDirName = basename(paths.dist);
const deploymentBranch = 'gh-pages';
const deploymentStaticContentDir = join(paths.source, 'project/gh-pages/');
const initialFile = 'package.json';
const TEMP_PREFIX = '__TEMP__';

// TODO support other kinds of deployments
// TODO add a flag to delete the existing deployment branch to avoid bloat (and maybe run `git gc --auto`)

export const task: Task = {
	description: 'deploy to gh-pages',
	run: async ({invokeTask}): Promise<void> => {
		// TODO how should this be done?
		process.env.NODE_ENV = 'production';

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

		// Clean up any existing worktree.
		await spawnProcess('git', ['worktree', 'remove', distDirName]);
		await spawnProcess('git', ['worktree', 'prune']);

		// Get ready to build from scratch.
		await invokeTask('clean');

		// Set up the deployment worktree in the dist directory.
		await spawnProcess('git', ['worktree', 'add', distDirName, deploymentBranch]);

		// Run the build.
		await invokeTask('build');

		// Copy everything from `src/project/gh-pages`. (like `CNAME` for GitHub custom domains)
		// If any files conflict, throw an error!
		// That should be part of the build process.
		if (await pathExists(deploymentStaticContentDir)) {
			await copy(deploymentStaticContentDir, paths.dist);
		}
		await copy(initialFile, join(paths.dist, initialFile));

		// At this point, `dist/` is ready to be committed and deployed!
		await spawnProcess('git', ['add', '.'], {cwd: paths.dist});
		await spawnProcess('git', ['commit', '-m', 'deployment'], {
			cwd: paths.dist,
		});
		await spawnProcess('git', ['push', 'origin', deploymentBranch], {
			cwd: paths.dist,
		});

		// Clean up the worktree so it doesn't interfere with development.
		// TODO maybe add a flag to preserve these files?
		// or maybe just create a separate `deploy` dir to avoid problems?
		await spawnProcess('git', ['worktree', 'remove', distDirName]);
		await spawnProcess('git', ['worktree', 'prune']);
	},
};
