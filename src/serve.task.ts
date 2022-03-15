import type {Task} from './task/task.js';
import {createGroServer} from './server/server.js';
import {Filer} from './build/Filer.js';
import {loadHttpsCredentials} from './server/https.js';
import type {ServeTaskArgs} from './serveTask.js';
import {ServeTaskArgsSchema} from './serveTask.schema.js';

export const task: Task<ServeTaskArgs> = {
	summary: 'start static file server',
	args: ServeTaskArgsSchema,
	run: async ({fs, log, args, dev}): Promise<void> => {
		const {_: servedDirs, host, port} = args;

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
