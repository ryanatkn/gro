import fs from 'fs-extra';
const {emptyDir, copy} = fs; // TODO esm
import {promisify} from 'util';
import {exec} from 'child_process';

import {Task} from './task/task.js';
import {paths} from './paths.js';
import {isTestBuildFile, isTestBuildArtifact} from './oki/testModule.js';

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);

export const task: Task = {
	description: 'create and link the distribution',
	run: async ({log: {info}}) => {
		info('emptying');
		await emptyDir(paths.dist);

		info('copying');
		await copy(paths.build, paths.dist, {
			filter: id => isDistFile(id),
		});

		info('linking');
		const {stdout, stderr} = await promisify(exec)('npm link');
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
	},
};
