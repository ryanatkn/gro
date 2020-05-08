import {spawn} from 'child_process';

import {Task} from './task/task.js';

export const task: Task = {
	description: 'typecheck the project without emitting any files',
	run: async () => {
		return new Promise((resolve, reject) => {
			const childProcess = spawn('node_modules/.bin/tsc', ['--noEmit'], {
				stdio: 'inherit',
			});
			childProcess.on('close', (code: number) => {
				if (code) {
					// TODO should tasks return a result instead of throwing?
					reject(new Error(`tsc failed with exit code ${code}`));
				} else {
					resolve();
				}
			});
		});
	},
};
