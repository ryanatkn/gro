import {attachProcessErrorHandlers} from '@feltjs/util/process.js';
import {sveltekit_sync} from './sveltekit_sync.js';

import {invoke_task} from './invoke_task.js';
import {to_task_args} from './args.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see `src/lib/docs/task.md`.

When the CLI is invoked it passes the first CLI arg as `task_name` to `invoke_task`,
and the rest of the args are forwarded to the task's `run` function.

*/

// handle uncaught errors
attachProcessErrorHandlers((err) => (err?.constructor?.name === 'TaskError' ? 'TaskError' : null));

// This is often wasteful but we're just going for correctness right now.
await sveltekit_sync();

const {task_name, args} = to_task_args();
await invoke_task(task_name, args);
