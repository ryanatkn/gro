import type {Spawned_Process} from '@feltcoop/felt/util/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Plugin} from './plugin.js';
import type {Task_Events as Server_Task_Events} from '../server.task.js';
import type {Args} from '../task/task.js';

export interface Options {
	api_server_path?: string;
}

export interface Task_Args extends Args {
	close_api_server?: (spawned: Spawned_Process) => Promise<void>; // let other tasks hang onto the api server
}

export const create_plugin = ({api_server_path}: Partial<Options> = EMPTY_OBJECT): Plugin<
	Task_Args,
	Server_Task_Events
> => {
	let spawned_api_server: Spawned_Process | null = null;
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		setup: async ({events, invoke_task, args}) => {
			// now that the sources are built, we can start the API server, if it exists
			events.once('server.spawn', (spawned) => {
				spawned_api_server = spawned;
			});
			// TODO this is weird and hacky
			const previous_args_api_server_path = args.api_server_path;
			args.api_server_path = api_server_path;
			await invoke_task('server');
			args.api_server_path = previous_args_api_server_path;
		},
		teardown: async ({args}) => {
			// done! clean up the API server
			if (args.close_api_server) {
				// don't await - whoever attached `close_api_server` will clean it up
				await args.close_api_server(spawned_api_server!);
			} else {
				spawned_api_server!.child.kill();
				await spawned_api_server!.closed;
			}
		},
	};
};
