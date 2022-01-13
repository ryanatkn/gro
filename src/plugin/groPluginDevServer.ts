import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import {type Args} from 'src/task/task.js';
import {type GroServer} from 'src/server/server.js';
import {loadHttpsCredentials} from '../server/https.js';
import {createGroServer} from '../server/server.js';

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

export const createPlugin = (): Plugin<PluginContext<TaskArgs, {}> & DevServerPluginContext> => {
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
			ctx.server = createGroServer({filer, host: config.host, port: config.port, https});
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
				ctx.server = undefined;
			}
		},
	};
};
