import type {Task} from './task/task.js';
import {toApiServerBuildPath} from './config/defaultBuildConfig.js';
import {spawn} from './utils/process.js';
import type {SpawnedProcess} from './utils/process.js';
import {red} from './utils/terminal.js';

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

export interface TaskArgs {
	apiServerPath?: string;
}

export interface TaskEvents {
	'server.spawn': (spawned: SpawnedProcess, apiServerPath: string) => void;
}

// TODO what's the best way to give a placeholder for the unused first `TArgs` type argument?
export const task: Task<TaskArgs, TaskEvents> = {
	description: 'start API server',
	run: async ({fs, dev, events, args, log}) => {
		const apiServerPath = args.apiServerPath ?? toApiServerBuildPath(dev);
		if (!(await fs.exists(apiServerPath))) {
			log.error(red('server path does not exist:'), apiServerPath);
			throw Error(`API server failed to start due to missing file: ${apiServerPath}`);
		}
		// TODO what if we wrote out the port and
		// also, retried if it conflicted ports, have some affordance here to increment and write to disk
		// on disk, we can check for that file in `svelte.config.cjs`
		const spawned = spawn('node', [apiServerPath]);
		events.emit('server.spawn', spawned, apiServerPath);
	},
};
