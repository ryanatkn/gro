import {Task} from './task/task.js';
import {compileSourceDirectory} from './compile/compileSourceDirectory.js';

export const task: Task = {
	description: 'compiles all files to the build directory',
	run: async ({log}) => {
		// TODO how to do this?
		const dev = process.env.NODE_ENV === 'development';
		await compileSourceDirectory(dev, log);
	},
};
