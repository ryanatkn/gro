import mri from 'mri';
import {attachProcessErrorHandlers} from '@feltcoop/felt/util/process.js';

import {invokeTask} from '../task/invokeTask.js';
import {fs as nodeFs} from '../fs/node.js';
import {TaskError} from '../task/task.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see `src/docs/task.md`.

When the CLI is invoked it passes the first CLI arg as `taskName` to `invokeTask`.

*/
const main = async () => {
	const args = mri(process.argv.slice(2));

	// install sourcemaps for Gro development
	if (process.env.NODE_ENV !== 'production') {
		const sourcemapSupport = await import('source-map-support'); // is a peer dependency
		sourcemapSupport.install({
			handleUncaughtExceptions: false,
		});
	}

	const taskName = args._.shift() || '';
	if (args._.length === 0) args._ = undefined as any; // enable schema defaults

	return invokeTask(nodeFs, taskName, args);
};

// see below for why we don't catch here
main(); // eslint-disable-line @typescript-eslint/no-floating-promises

// handle uncaught errors
attachProcessErrorHandlers((err) => (err instanceof TaskError ? 'TaskError' : null));
