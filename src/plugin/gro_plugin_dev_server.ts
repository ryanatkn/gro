import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';
import type {GroServer} from 'src/server/server.js';
import {load_https_credentials} from '../server/https.js';
import {create_gro_server} from '../server/server.js';

const name = '@feltcoop/gro_plugin_dev_server';

export interface TaskArgs extends Args {
	insecure?: boolean;
	cert?: string;
	certkey?: string;
	watch?: boolean;
}

export interface DevServerPluginContext {
	server?: GroServer; // TODO how to make this work with a plugin?
}

export const create_plugin = (): Plugin<PluginContext<TaskArgs, {}> & DevServerPluginContext> => {
	let started_server = false;
	return {
		name,
		setup: async (ctx) => {
			const {config, fs, filer, timings, args, log} = ctx;
			if (!filer) throw Error(`${name} expects a filer arg`);

			const timing_to_create_gro_server = timings.start('create dev server');
			const https = args.insecure
				? null
				: await load_https_credentials(fs, log, args.cert, args.certkey);
			ctx.server = create_gro_server({filer, host: config.host, port: config.port, https});
			// TODO set on context and return context, right?
			timing_to_create_gro_server();

			if (args.watch) {
				const timing_to_start_gro_server = timings.start('start dev server');
				await ctx.server.start();
				timing_to_start_gro_server();
				started_server = true;
			}
		},
		teardown: async (ctx) => {
			if (started_server && ctx.server) {
				await ctx.server.close();
				ctx.server = undefined;
			}
		},
	};
};
