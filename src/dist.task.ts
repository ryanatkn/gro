import {promisify} from 'util';
import {exec} from 'child_process';

import {emptyDir, copy} from './fs/nodeFs.js';
import {Task} from './task/task.js';
import {paths} from './paths.js';
import {isTestBuildFile, isTestBuildArtifact} from './oki/testModule.js';
import {fmtPath} from './utils/fmt.js';

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);

export const task: Task = {
	description: 'create and link the distribution',
	run: async ({log: {info}}) => {
		info(`emptying ${fmtPath(paths.dist)}`);
		await emptyDir(paths.dist);

		info('copying build');
		await copy(paths.build, paths.dist, {
			filter: id => isDistFile(id),
		});

		info('linking');
		const {stdout, stderr} = await promisify(exec)('npm link');
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
	},
};
