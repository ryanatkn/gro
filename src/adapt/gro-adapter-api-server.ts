import type {SpawnedProcess} from '@feltcoop/felt/utils/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';

import type {Adapter} from './adapter.js';
import type {TaskEvents as ServerTaskEvents} from '../server.task.js';
import type {Args} from '../task/task.js';

// TODO WIP do not use
// TODO name? is it actually specific to frontends? or is this more about bundling?

export interface Options {
	apiServerPath?: string;
}

export interface TaskArgs extends Args {
	closeApiServer?: (spawned: SpawnedProcess) => Promise<void>; // let other tasks hang onto the api server
}

export const createAdapter = ({apiServerPath}: Partial<Options> = EMPTY_OBJECT): Adapter<
	TaskArgs,
	ServerTaskEvents
> => {
	let spawnedApiServer: SpawnedProcess | null = null;
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		// adapt: async ({config, args, events, invokeTask}) => {
		// 	// const buildConfigsToBuild = config.builds.filter((b) => builds.includes(b.name));
		// },
		begin: async ({events, invokeTask, args}) => {
			// now that the sources are built, we can start the API server, if it exists
			events.once('server.spawn', (spawned) => {
				spawnedApiServer = spawned;
			});
			const p = args.apiServerPath;
			args.apiServerPath = apiServerPath;
			await invokeTask('server');
			args.apiServerPath = p;
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
