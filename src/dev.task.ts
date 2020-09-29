import {Task} from './task/task.js';
import {Filer} from './fs/Filer.js';
import {createDevServer} from './devServer/devServer.js';
import {createDefaultCompiler} from './compile/defaultCompiler.js';

export const task: Task = {
	description: 'start development server',
	run: async (): Promise<void> => {
		const filer = new Filer({compiler: createDefaultCompiler()});

		const devServer = createDevServer({filer});

		await Promise.all([filer.init(), devServer.start()]);
	},
};
