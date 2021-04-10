import type {Task} from './task/task.js';
import {createGroServer, DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT} from './server/server.js';
import {Filer} from './build/Filer.js';
import {loadHttpsCredentials} from './server/https.js';
import type {ServedDirPartial} from './build/ServedDir.js';
import {nodeFsHost} from './fs/node.js';

export interface TaskArgs {
	_: string[];
	serve?: ServedDirPartial[]; // takes priority over the CLI arg "_" above
	host?: string;
	port?: string | number;
	nocert?: boolean;
	certfile?: string;
	certkeyfile?: string;
}

export const task: Task<TaskArgs> = {
	description: 'start static file server',
	run: async ({log, args, dev}): Promise<void> => {
		const host = args.host || DEFAULT_SERVER_HOST;
		const port = Number(args.port) || DEFAULT_SERVER_PORT;
		const servedDirs: ServedDirPartial[] = args.serve || (args._.length ? args._ : ['.']);
		console.log('servedDirs', servedDirs);

		// TODO this is inefficient for just serving files in a directory
		// maybe we want a `lazy` flag?
		const filer = new Filer({fs: nodeFsHost, servedDirs, dev});
		await filer.init();

		// TODO write docs and validate args, maybe refactor, see also `dev.task.ts`
		const https = args.nocert
			? null
			: await loadHttpsCredentials(log, args.certfile, args.certkeyfile);

		const server = createGroServer({filer, host, port, https});
		log.info(`serving on ${server.host}:${server.port}`, ...servedDirs);
		await server.start();
	},
};
