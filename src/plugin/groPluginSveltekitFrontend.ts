import {spawn, spawnProcess, type SpawnedProcess} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin, PluginContext} from './plugin.js';
import {printCommandArgs, serializeArgs, toForwardedArgs, type Args} from '../utils/args.js';

export interface Options {} // eslint-disable-line @typescript-eslint/no-empty-interface

export interface TaskArgs extends Args {
	watch?: boolean;
}

const name = '@feltcoop/groPluginSveltekitFrontend';

// eslint-disable-next-line no-empty-pattern
export const createPlugin = ({}: Partial<Options> = EMPTY_OBJECT): Plugin<
	PluginContext<TaskArgs, object>
> => {
	let sveltekitProcess: SpawnedProcess | null = null;
	return {
		name,
		setup: async ({dev, args, log}) => {
			if (dev) {
				if (args.watch) {
					const forwardedArgs = toForwardedArgs('svelte-kit');
					const serializedArgs = ['svelte-kit', 'dev', ...serializeArgs(forwardedArgs)];
					log.info(printCommandArgs(serializedArgs));
					sveltekitProcess = spawnProcess('npx', serializedArgs);
				} else {
					log.trace(
						`${name} is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				const forwardedArgs = toForwardedArgs('svelte-kit');
				const serializedArgs = ['svelte-kit', 'build', ...serializeArgs(forwardedArgs)];
				log.info(printCommandArgs(serializedArgs));
				await spawn('npx', serializedArgs);
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
