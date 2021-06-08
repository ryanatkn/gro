import type {Spawned_Process} from '@feltcoop/felt/utils/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';

import type {Adapter} from './adapter.js';
import type {Task_Events as ServerTask_Events} from '../server.task.js';
import type {Args} from '../task/task.js';

// TODO WIP do not use
// TODO name? is it actually specific to frontends? or is this more about bundling?

export interface Options {
	api_server_path?: string;
}

export interface Task_Args extends Args {
	closeApiServer?: (spawned: Spawned_Process) => Promise<void>; // let other tasks hang onto the api server
}

export const create_adapter = ({api_server_path}: Partial<Options> = EMPTY_OBJECT): Adapter<
	Task_Args,
	ServerTask_Events
> => {
	let spawnedApiServer: Spawned_Process | null = null;
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		// adapt: async ({config, args, events, invoke_task}) => {
		// 	// const build_configsToBuild = config.builds.filter((b) => builds.includes(b.name));
		// },
		begin: async ({events, invoke_task, args}) => {
			// now that the sources are built, we can start the API server, if it exists
			events.once('server.spawn', (spawned) => {
				spawnedApiServer = spawned;
			});
			const p = args.api_server_path;
			args.api_server_path = api_server_path;
			await invoke_task('server');
			args.api_server_path = p;
		},
		end: async ({args}) => {
			// done! clean up the API server
			if (args.closeApiServer) {
				// don't await - whoever attached `closeApiServer` will clean it up
				await args.closeApiServer(spawnedApiServer!);
			} else {
				spawnedApiServer!.child.kill();
				await spawnedApiServer!.closed;
			}
		},
	};
};
