import {Task} from './task/task.js';
import * as buildTask from './build.task.js';
import * as serveTask from './serve.task.js';

const DEFAULT_SERVE_DIR = 'dist/';

export const task: Task = {
	description: 'Start development server',
	run: async (ctx): Promise<void> => {
		// TODO fix these
		ctx.args.watch = true; // TODO always?
		ctx.args.dir = ctx.args.dir || DEFAULT_SERVE_DIR;
		// TODO also take HOST and PORT from env
		// .option('-H, --host', 'Hostname for the server')
		// .option('-p, --port', 'Port number for the server')
		// .option('-d, --dir', 'Directory to serve')
		// .option('-o, --outputDir', 'Directory for the build output')
		// .option('-w, --watch', 'Watch for changes and rebuild')
		// .option('-P, --production', 'Set NODE_ENV to production')

		await Promise.all([buildTask.task.run(ctx), serveTask.task.run(ctx)]);

		// ...
	},
};
