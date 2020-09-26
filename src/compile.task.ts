import {Task} from './task/task.js';
import {compileSourceDirectory} from './compile/compileSourceDirectory.js';

export const task: Task = {
	description: 'compiles all files to the build directory',
	run: async ({log}) => {
		await compileSourceDirectory(log);
	},
};
