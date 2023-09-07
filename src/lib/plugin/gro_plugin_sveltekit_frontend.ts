import {spawn, spawnProcess, type SpawnedProcess} from '@feltjs/util/process.js';
import {EMPTY_OBJECT} from '@feltjs/util/object.js';

import type {Plugin, PluginContext} from './plugin.js';
import {print_command_args, serialize_args, to_forwarded_args, type Args} from '../task/args.js';

export interface Options {} // eslint-disable-line @typescript-eslint/no-empty-interface

export interface TaskArgs extends Args {
	watch?: boolean;
}

const name = 'gro_plugin_sveltekit_frontend';

// eslint-disable-next-line no-empty-pattern
export const create_plugin = ({}: Partial<Options> = EMPTY_OBJECT): Plugin<
	PluginContext<TaskArgs, object>
> => {
	let sveltekitProcess: SpawnedProcess | null = null;
	return {
		name,
		setup: async ({dev, args, log}) => {
			if (dev) {
				if (args.watch) {
					const serialized_args = ['vite', 'dev', ...serialize_args(to_forwarded_args('vite'))];
					log.info(print_command_args(serialized_args));
					sveltekitProcess = spawnProcess('npx', serialized_args);
				} else {
					log.debug(
						`${name} is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				const serialized_args = ['vite', 'build', ...serialize_args(to_forwarded_args('vite'))];
				log.info(print_command_args(serialized_args));
				await spawn('npx', serialized_args);
			}
		},
		teardown: async () => {
			if (sveltekitProcess) {
				sveltekitProcess.child.kill();
				await sveltekitProcess.closed;
			}
		},
	};
};
