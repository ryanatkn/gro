import fs from 'fs-extra';
const {emptyDir, copy} = fs; // TODO esm
import {promisify} from 'util';
import {exec} from 'child_process';

import {Task} from '../run/task.js';
import {paths} from '../paths.js';
import {isTestFile, isTestArtifact} from '../oki/node/NodeTestContext.js';

export const isDistFile = (path: string): boolean =>
	!isTestFile(path) && !isTestArtifact(path);

export const task: Task = {
	description: 'create and link the gro distribution',
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
