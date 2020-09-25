import {resolve} from 'path';

import {Task} from './task/task.js';
import {createDevServer} from './devServer/devServer.js';
import {FileCache} from './fs/FileCache.js';
import {createCompiler} from './compile/compiler.js';

export const task: Task = {
	description: 'start static file server',
	run: async ({log, args}): Promise<void> => {
		if (process.env.NODE_ENV === 'production') {
			// We don't want to have to worry about the security of the dev server.
			throw Error('Serve should not be used in production');
		}
		// TODO also take these from args
		const host: string | undefined = process.env.HOST;
		const port: number | undefined = Number(process.env.PORT) || undefined;
		const dir: string | undefined = args.dir ? resolve(args.dir as string) : undefined;

		const fileCache: FileCache =
			(args.fileCache as any) || new FileCache({compiler: createCompiler({dev: true, log})});

		const devServer = createDevServer({fileCache, host, port, dir});
		log.info(`serving ${dir} on ${host}:${port}`);
		await devServer.start();

		// ...
	},
};
