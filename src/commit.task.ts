import {join} from 'path';
import {spawn} from '@feltjs/util/process.js';
import {printError} from '@feltjs/util/print.js';
import {green, red} from 'kleur/colors';
import {z} from 'zod';

import {rainbow} from './utils/colors.js';
import type {Task} from './task/task.js';
import {DIST_DIR, GIT_DIRNAME, paths, printPath, SVELTEKIT_DIST_DIRNAME} from './paths.js';
import {cleanFs} from './fs/clean.js';
import {toRawRestArgs} from './utils/args.js';
import {GIT_DEPLOY_SOURCE_BRANCH, GIT_DEPLOY_TARGET_BRANCH} from './build/buildConfigDefaults.js';

// TODO customize
const WORKTREE_DIRNAME = 'worktree';
const WORKTREE_DIR = `${paths.root}${WORKTREE_DIRNAME}`;
const ORIGIN = 'origin';
const INITIAL_FILE = 'package.json'; // this is a single file that's copied into the new branch to bootstrap it
const TEMP_PREFIX = '__TEMP__';
const GIT_ARGS = {cwd: WORKTREE_DIR};
const DANGEROUS_BRANCHES = ['main', 'master'];

const Args = z
	.object({
		_: z.array(z.string()),
	})
	.strict();
type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'commit and push to a new branch',
	production: true,
	Args,
	run: async ({fs, args, log}): Promise<void> => {
		console.log(`args`, args);

		await spawn('git', ['commit', '-m', 'commitment'], GIT_ARGS);
	},
};
