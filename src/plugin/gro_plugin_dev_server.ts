import type {Plugin, Plugin_Context} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';
import type {Gro_Server} from 'src/server/server.js';
import {load_https_credentials} from '../server/https.js';
import {create_gro_server} from '../server/server.js';

const name = '@feltcoop/gro_plugin_dev_server';

export interface Task_Args extends Args {
	insecure?: boolean;
	cert?: string;
	certkey?: string;
	watch?: boolean;
}

export interface Dev_Server_Plugin_Context {
	server?: Gro_Server; // TODO how to make this work with a plugin?
}

export const create_plugin = (): Plugin<
	Plugin_Context<Task_Args, {}> & Dev_Server_Plugin_Context
> => {
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
			}
		},
		teardown: async (ctx) => {
			if (ctx.server) {
				await ctx.server.close();
				ctx.server = undefined;
			}
		},
	};
};
