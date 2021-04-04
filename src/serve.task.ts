import type {Task} from './task/task.js';
import {createGroServer} from './server/server.js';
import {Filer} from './build/Filer.js';
import {printPath} from './utils/print.js';
import {loadHttpsCredentials} from './server/https.js';
import {numberFromEnv, stringFromEnv} from './utils/env.js';

export interface TaskArgs {
	_: string[];
	host?: string;
	port?: string | number;
	nocert?: boolean;
	certfile?: string;
	certkeyfile?: string;
}

export const task: Task<TaskArgs> = {
	description: 'start static file server',
	run: async ({log, args}): Promise<void> => {
		const host = args.host || stringFromEnv('HOST');
		const port = Number(args.port) || numberFromEnv('PORT');
		const servedDirs = args._.length ? args._ : ['.'];

		// TODO this is inefficient for just serving files in a directory
		// maybe we want a `lazy` flag?
		const filer = new Filer({servedDirs});
		await filer.init();

		// TODO write docs and validate args, maybe refactor, see also `dev.task.ts`
		const https = args.nocert
			? null
			: await loadHttpsCredentials(log, args.certfile, args.certkeyfile);

		const server = createGroServer({filer, host, port, https});
		log.info(`serving on ${server.host}:${server.port}`, ...servedDirs.map((d) => printPath(d)));
		await server.start();
	},
};
