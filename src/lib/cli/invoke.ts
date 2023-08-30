import {attachProcessErrorHandlers} from '@feltjs/util/process.js';

import {invokeTask} from '../task/invokeTask.js';
import {fs} from '../fs/node.js';
import {TaskError} from '../task/task.js';
import {toTaskArgs} from '../task/args.js';

// handle uncaught errors
attachProcessErrorHandlers((err) => (err instanceof TaskError ? 'TaskError' : null));

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see `src/lib/docs/task.md`.

When the CLI is invoked it passes the first CLI arg as `taskName` to `invokeTask`,
and the rest of the args are forwarded to the task's `run` function.

*/

// TODO BLOCK maybe remove this? or always include it?
// install sourcemaps for Gro development
// const sourcemapSupport = await import('source-map-support'); // is a peer dependency
// sourcemapSupport.install({handleUncaughtExceptions: false});

const {taskName, args} = toTaskArgs();
await invokeTask(fs, taskName, args);
