import {type Task} from './task/task.js';
import {createGroServer, DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT} from './server/server.js';
import {Filer} from './build/Filer.js';
import {loadHttpsCredentials} from './server/https.js';
import {type ServedDirPartial} from './build/servedDir.js';
import {type ServeTaskArgs} from './serveTask.js';
import {ServeTaskArgsSchema} from './serveTask.schema.js';

export const task: Task<ServeTaskArgs> = {
	summary: 'start static file server',
	args: ServeTaskArgsSchema,
	run: async ({fs, log, args, dev}): Promise<void> => {
		const host = args.host || DEFAULT_SERVER_HOST;
		const port = Number(args.port) || DEFAULT_SERVER_PORT;
		const servedDirs: ServedDirPartial[] = args.serve || (args._.length ? args._ : ['.']);

		// TODO this is inefficient for just serving files in a directory
		// maybe we want a `lazy` flag?
		const filer = new Filer({fs, servedDirs, dev});
		await filer.init();

		// TODO write docs and validate args, maybe refactor, see also `dev.task.ts`
		const https = args.insecure
			? null
			: await loadHttpsCredentials(fs, log, args.cert, args.certkey);

		const server = createGroServer({filer, host, port, https});
		log.info(`serving on ${server.host}:${server.port}`, ...servedDirs);
		await server.start();
	},
};
