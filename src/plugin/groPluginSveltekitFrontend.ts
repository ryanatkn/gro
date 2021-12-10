import type {SpawnedProcess} from '@feltcoop/felt/util/process.js';
import {spawn, spawnProcess} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';

export interface Options {}

export interface TaskArgs extends Args {
	watch?: boolean;
	// `svelte-kit dev` and `svelte-kit preview` args
	port?: number;
	open?: boolean;
	host?: string;
	https?: boolean;
	// `svelte-kit build` args
	verbose?: boolean;
}

const name = '@feltcoop/groPluginSveltekitFrontend';

export const createPlugin = ({}: Partial<Options> = EMPTY_OBJECT): Plugin<
	PluginContext<TaskArgs, {}>
> => {
	let sveltekitProcess: SpawnedProcess | null = null;
	return {
		name,
		setup: async ({dev, args, log}) => {
			if (dev) {
				if (args.watch) {
					sveltekitProcess = spawnProcess('npx', toSveltekitArgs('dev', args));
				} else {
					log.warn(
						`${name} is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				await spawn('npx', toSveltekitArgs('build', args));
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

const toSveltekitArgs = (command: 'dev' | 'build' | 'preview', args: TaskArgs): string[] => {
	const sveltekitArgs = ['svelte-kit', command];
	if (command === 'dev' || command === 'preview') {
		if (args.port) {
			sveltekitArgs.push('--port', args.port.toString());
		}
		if (args.open) {
			sveltekitArgs.push('--open');
		}
		if (args.host) {
			sveltekitArgs.push('--host', args.host);
		}
		if (args.https) {
			sveltekitArgs.push('--https');
		}
	} else if (command === 'build') {
		if (args.verbose) {
			sveltekitArgs.push('--verbose');
		}
	}
	return sveltekitArgs;
};
