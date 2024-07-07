import {attach_process_error_handlers} from '@ryanatkn/belt/process.js';

import {invoke_task} from './invoke_task.js';
import {to_task_args} from './args.js';
import {load_config} from './config.js';
import {sveltekit_sync_if_obviously_needed} from './sveltekit_helpers.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see `src/docs/task.md`.

When the CLI is invoked it passes the first CLI arg as `task_name` to `invoke_task`,
and the rest of the args are forwarded to the task's `run` function.

*/

// handle uncaught errors
attach_process_error_handlers((err) =>
	err?.constructor?.name === 'Task_Error' ? 'Task_Error' : null,
);

await sveltekit_sync_if_obviously_needed();

const {task_name, args} = to_task_args();
await invoke_task(task_name, args, await load_config());
