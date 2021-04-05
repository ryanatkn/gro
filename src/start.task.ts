import type {Task} from './task/task.js';
import {pathExists} from './fs/nodeFs.js';
import {DIST_DIR} from './paths.js';
import {spawnProcess} from './utils/process.js';

export const task: Task = {
	description: 'alias for npm start that builds if needed',
	dev: false,
	run: async ({invokeTask}) => {
		if (!(await pathExists(DIST_DIR))) {
			await invokeTask('build');
		}
		// TODO should we try to start the server, or whatever the best guess is?
		// or actually defer to npm like this, which is hardcoded but more Node-friendly?
		// maybe put passthrough behind a flag?
		await spawnProcess('npm', ['start', ...process.argv.slice(3)]);
	},
};
