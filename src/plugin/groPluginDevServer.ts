import {type Plugin, type PluginContext} from './plugin.js';
import {type Args} from '../task/task.js';
import {loadHttpsCredentials} from '../server/https.js';
import {createGroServer, type GroServer} from '../server/server.js';

const name = '@feltcoop/groPluginDevServer';

export interface TaskArgs extends Args {
	insecure?: boolean;
	cert?: string;
	certkey?: string;
	watch?: boolean;
}

export interface DevServerPluginContext {
	server?: GroServer; // TODO how to make this work with a plugin?
}

export const createPlugin = (): Plugin<
	PluginContext<TaskArgs, object> & DevServerPluginContext
> => {
	let startedServer = false;
	return {
		name,
		setup: async (ctx) => {
			const {config, fs, filer, timings, args, log} = ctx;
			if (!filer) throw Error(`${name} expects a filer arg`);

			const timingToCreateGroServer = timings.start('create dev server');
			const https = args.insecure
				? null
				: await loadHttpsCredentials(fs, log, args.cert, args.certkey);
			ctx.server = createGroServer({filer, host: config.host, port: config.port, https}); // eslint-disable-line require-atomic-updates
			// TODO set on context and return context, right?
			timingToCreateGroServer();

			if (args.watch) {
				const timingToStartGroServer = timings.start('start dev server');
				await ctx.server.start();
				timingToStartGroServer();
				startedServer = true;
			}
		},
		teardown: async (ctx) => {
			if (startedServer && ctx.server) {
				await ctx.server.close();
				ctx.server = undefined; // eslint-disable-line require-atomic-updates
			}
		},
	};
};
