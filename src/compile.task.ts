import {Task} from './task/task.js';
import {compile} from './compile/compile.js';
import {cleanBuild} from './project/clean.js';

export const task: Task = {
	description: 'compiles all files to the build directory',
	run: async ({log}) => {
		await cleanBuild(log);
		await compile(log);
	},
};
