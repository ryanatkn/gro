import {Task} from './task/task.js';
import {FileCache} from './fs/FileCache.js';
import {createCompiler} from './compile/compiler.js';
import {createDevServer} from './devServer/devServer.js';

export const task: Task = {
	description: 'start development server',
	run: async ({log}): Promise<void> => {
		const fileCache = new FileCache({compiler: createCompiler({dev: true, log})});

		const devServer = createDevServer({fileCache});

		await Promise.all([fileCache.init(), devServer.start()]);
	},
};
