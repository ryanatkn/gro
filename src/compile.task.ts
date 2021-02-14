import {Task} from './task/task.js';
import {buildSourceDirectory} from './build/buildSourceDirectory.js';
import {loadGroConfig} from './config/config.js';

export const task: Task = {
	description: 'compiles all files to the build directory',
	run: async ({log}) => {
		// TODO how to do this?
		const dev = process.env.NODE_ENV !== 'production';
		await buildSourceDirectory(await loadGroConfig(), dev, log);
	},
};
