import {Task} from './task/task.js';
import {Filer} from './fs/Filer.js';
import {createCompiler} from './compile/compiler.js';
import {createDevServer} from './devServer/devServer.js';
import {paths} from './paths.js';

export const task: Task = {
	description: 'start development server',
	run: async ({log}): Promise<void> => {
		const filer = new Filer({compiler: createCompiler({dev: true, log})});

		const devServer = createDevServer({filer, dir: paths.build});

		await Promise.all([filer.init(), devServer.start()]);
	},
};
