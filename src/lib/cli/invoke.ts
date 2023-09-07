import {attachProcessErrorHandlers} from '@feltjs/util/process.js';
import sourcemapSupport from 'source-map-support';

import {invoke_task} from '../task/invoke_task.js';
import {fs} from '../fs/node.js';
import {TaskError} from '../task/task.js';
import {toTaskArgs} from '../task/args.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see `src/lib/docs/task.md`.

When the CLI is invoked it passes the first CLI arg as `taskName` to `invoke_task`,
and the rest of the args are forwarded to the task's `run` function.

*/

// handle uncaught errors
attachProcessErrorHandlers((err) => (err instanceof TaskError ? 'TaskError' : null));

// install sourcemaps for user tasks
// TODO remove after changing to runtime compilation
sourcemapSupport.install({handleUncaughtExceptions: false});

const {taskName, args} = toTaskArgs();
await invoke_task(fs, taskName, args);
