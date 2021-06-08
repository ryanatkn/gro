import {spawn} from '@feltcoop/felt/utils/process.js';
import type {Spawned_Process} from '@feltcoop/felt/utils/process.js';
import {red} from '@feltcoop/felt/utils/terminal.js';

import type {Task} from './task/task.js';
import {to_api_server_build_path} from './build/default_build_config.js';

/*

Normally, you won't use this directly, but it's here
if you need it, and for educational purposes.
It's invoked by `src/dev.task.ts` and `src/build.task.ts`
as a default to support compatibility with SvelteKit.

If you see an error message with 3001 missing or something,
try running `gro server` to run this task file!
But it should be handled by the other tasks.

## usage

```bash
gro server
```

TODO configure port

*/

export interface Task_Args {
	api_server_path?: string;
}

export interface Task_Events {
	'server.spawn': (spawned: Spawned_Process, api_server_path: string) => void;
}

// TODO what's the best way to give a placeholder for the unused first `TArgs` type argument?
export const task: Task<Task_Args, Task_Events> = {
	description: 'start API server',
	run: async ({fs, dev, events, args, log}) => {
		const api_server_path = args.api_server_path ?? to_api_server_build_path(dev);
		if (!(await fs.exists(api_server_path))) {
			log.error(red('server path does not exist:'), api_server_path);
			throw Error(`API server failed to start due to missing file: ${api_server_path}`);
		}
		// TODO what if we wrote out the port and
		// also, retried if it conflicted ports, have some affordance here to increment and write to disk
		// on disk, we can check for that file in `svelte.config.cjs`
		const spawned = spawn('node', [api_server_path]);
		events.emit('server.spawn', spawned, api_server_path);
	},
};
