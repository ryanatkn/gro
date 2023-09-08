import {attachProcessErrorHandlers} from '@feltjs/util/process.js';
import sourcemap_support from 'source-map-support';
import {sveltekit_sync} from '../util/sveltekit_sync.js';

import {invoke_task} from '../task/invoke_task.js';
import {fs} from '../fs/node.js';
import {TaskError} from '../task/task.js';
import {to_task_args} from '../task/args.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see `src/lib/docs/task.md`.

When the CLI is invoked it passes the first CLI arg as `task_name` to `invoke_task`,
and the rest of the args are forwarded to the task's `run` function.

*/

// handle uncaught errors
attachProcessErrorHandlers((err) => (err instanceof TaskError ? 'TaskError' : null));

// install sourcemaps for user tasks
// TODO remove after changing to runtime compilation
sourcemap_support.install({handleUncaughtExceptions: false});

// This is often wasteful but we're just going for correctness right now.
await sveltekit_sync(fs);

const {task_name, args} = to_task_args();
await invoke_task(fs, task_name, args);
