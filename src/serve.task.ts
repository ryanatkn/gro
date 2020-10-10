import {Task} from './task/task.js';
import {createDevServer} from './devServer/devServer.js';
import {Filer} from './build/Filer.js';
import {printPath} from './utils/print.js';

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
		const servedDirs: string[] = args._.length ? args._ : ['.'];

		// TODO this is inefficient for just serving files in a directory
		// maybe we want a `lazy` flag?
		const filer = new Filer({servedDirs});
		await filer.init();

		const devServer = createDevServer({filer, host, port});
		log.info(
			`serving on ${devServer.host}:${devServer.port}`,
			...servedDirs.map((d) => printPath(d)),
		);
		await devServer.start();
	},
};
