import {attachProcessErrorHandlers} from '@feltcoop/util';

import {invokeTask} from '../task/invokeTask.js';
import {fs as nodeFs} from '../fs/node.js';
import {TaskError} from '../task/task.js';
import {toTaskArgs} from '../utils/args.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see `src/docs/task.md`.

When the CLI is invoked it passes the first CLI arg as `taskName` to `invokeTask`.

*/
const main = async () => {
	// install sourcemaps for Gro development
	if (process.env.NODE_ENV !== 'production') {
		const sourcemapSupport = await import('source-map-support'); // is a peer dependency
		sourcemapSupport.install({handleUncaughtExceptions: false});
	}
	const {taskName, args} = toTaskArgs();
	return invokeTask(nodeFs, taskName, args);
};

// handle uncaught errors
attachProcessErrorHandlers((err) => (err instanceof TaskError ? 'TaskError' : null));

// see above for why we don't catch here
void main();
