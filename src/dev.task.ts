import {Task} from './task/task.js';
import {FileCache} from './fs/FileCache.js';
import {createCompiler} from './compile/compiler.js';
import {createDevServer} from './devServer/devServer.js';
import {paths} from './paths.js';

export const task: Task = {
	description: 'start development server',
	run: async ({log}): Promise<void> => {
		const fileCache = new FileCache({compiler: createCompiler({dev: true, log})});

		const devServer = createDevServer({fileCache, dir: paths.build});

		await Promise.all([fileCache.init(), devServer.start()]);
	},
};
