import {Task} from './task/task.js';
import {compileSourceDirectory} from './compile/compileSourceDirectory.js';
import {loadConfig} from './config/config.js';

export const task: Task = {
	description: 'compiles all files to the build directory',
	run: async ({log}) => {
		// TODO how to do this?
		const dev = process.env.NODE_ENV !== 'production';
		await compileSourceDirectory(await loadConfig(), dev, log);
	},
};
