import type {Task} from './task/task.js';
import {create_gro_server, DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT} from './server/server.js';
import {Filer} from './build/Filer.js';
import {load_https_credentials} from './server/https.js';
import type {Served_Dir_Partial} from './build/served_dir.js';

export interface Task_Args {
	_: string[];
	serve?: Served_Dir_Partial[]; // takes priority over the CLI arg "_" above
	host?: string;
	port?: string | number;
	insecure?: boolean;
	cert?: string;
	certkey?: string;
}

export const task: Task<Task_Args> = {
	description: 'start static file server',
	run: async ({fs, log, args, dev}): Promise<void> => {
		const host = args.host || DEFAULT_SERVER_HOST;
		const port = Number(args.port) || DEFAULT_SERVER_PORT;
		const served_dirs: Served_Dir_Partial[] = args.serve || (args._.length ? args._ : ['.']);
		console.log('served_dirs', served_dirs);

		// TODO this is inefficient for just serving files in a directory
		// maybe we want a `lazy` flag?
		const filer = new Filer({fs, served_dirs, dev});
		await filer.init();

		// TODO write docs and validate args, maybe refactor, see also `dev.task.ts`
		const https = args.insecure
			? null
			: await load_https_credentials(fs, log, args.cert, args.certkey);

		const server = create_gro_server({filer, host, port, https});
		log.info(`serving on ${server.host}:${server.port}`, ...served_dirs);
		await server.start();
	},
};
