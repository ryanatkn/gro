import {Task} from './task/task.js';
import {createDevServer} from './server/server.js';
import {Filer} from './build/Filer.js';
import {printPath} from './utils/print.js';
import {loadHttpsCredentials} from './server/https.js';

export const task: Task = {
	description: 'start static file server',
	run: async ({log, args}): Promise<void> => {
		if (process.env.NODE_ENV === 'production') {
			// We don't want to have to worry about the security of the dev server.
			throw Error('Serve should not be used in production');
		}
		// TODO validate
		const host: string | undefined = (args.host as string) || process.env.HOST;
		const port: number | undefined = Number(args.port) || Number(process.env.PORT) || undefined;
		const servedDirs: string[] = args._.length ? args._ : ['.'];

		// TODO this is inefficient for just serving files in a directory
		// maybe we want a `lazy` flag?
		const filer = new Filer({servedDirs});
		await filer.init();

		// TODO write docs and validate args, maybe refactor, see also `dev.task.ts`
		const https = args.nocert
			? null
			: await loadHttpsCredentials(log, args.certfile as string, args.certkeyfile as string);

		const server = createDevServer({filer, host, port, https});
		log.info(`serving on ${server.host}:${server.port}`, ...servedDirs.map((d) => printPath(d)));
		await server.start();
	},
};
