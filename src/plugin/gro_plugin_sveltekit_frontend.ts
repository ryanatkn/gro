import type {Spawned_Process} from '@feltcoop/felt/util/process.js';
import {spawn, spawn_process} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';

export interface Options {}

export interface Task_Args extends Args {
	watch?: boolean;
	// `svelte-kit dev` and `svelte-kit preview` args
	port?: number;
	open?: boolean;
	host?: string;
	https?: boolean;
	// `svelte-kit build` args
	verbose?: boolean;
}

const name = '@feltcoop/gro_adapter_sveltekit_frontend';

export const create_plugin = ({}: Partial<Options> = EMPTY_OBJECT): Plugin<Task_Args, {}> => {
	let sveltekit_process: Spawned_Process | null = null;
	return {
		name,
		setup: async ({dev, args, log}) => {
			if (dev) {
				if (args.watch) {
					sveltekit_process = spawn_process('npx', to_sveltekit_args('dev', args));
				} else {
					log.warn(
						`${name} is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				await spawn('npx', to_sveltekit_args('build', args));
			}
		},
		teardown: async () => {
			if (sveltekit_process) {
				sveltekit_process.child.kill();
				await sveltekit_process.closed;
			}
		},
	};
};

const to_sveltekit_args = (command: 'dev' | 'build', args: Task_Args): string[] => {
	const sveltekit_args = ['svelte-kit', command];
	if (command === 'dev') {
		if (args.port) {
			console.log('ARGS', args.port, typeof args.port);
			sveltekit_args.push('--port', args.port.toString());
		}
		if (args.open) {
			sveltekit_args.push('--open');
		}
		if (args.host) {
			sveltekit_args.push('--host', args.host);
		}
		if (args.https) {
			sveltekit_args.push('--https');
		}
	} else if (command === 'build') {
		if (args.verbose) {
			sveltekit_args.push('--verbose');
		}
	}
	return sveltekit_args;
};
