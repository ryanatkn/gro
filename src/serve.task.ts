import {resolve} from 'path';

import {Task} from './task/task.js';
import {createDevServer} from './devServer/devServer.js';

const DEFAULT_HOST = '0.0.0.0'; // 'localhost'; why is 0.0.0.0 needed here but not for sirv?
const DEFAULT_PORT = 8999;
const DEFAULT_DIR = './';

export const task: Task = {
	description: 'Start static file server',
	run: async ({log: {info}, args, env}): Promise<void> => {
		// TODO also take these from args
		const host: string = env.HOST || DEFAULT_HOST;
		const port: number = Number(env.PORT) || DEFAULT_PORT;
		const dir: string = resolve((args.dir as any) || DEFAULT_DIR);

		const devServer = createDevServer({host, port, dir});
		info(`serving ${dir} on ${host}:${port}`);
		await devServer.start();

		// ...
	},
};
