// handle uncaught errors
import {attachProcessErrorHandlers} from '../utils/process.js';
attachProcessErrorHandlers();

// install sourcemaps
import sourcemapSupport from 'source-map-support';
sourcemapSupport.install({
	handleUncaughtExceptions: false,
});

import mri from 'mri';

import type {Args} from '../task/task.js';
import {invokeTask} from '../task/invokeTask.js';
import {nodeFilesystem} from '../fs/node.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see the docs at `src/task/README.md`.

When the CLI is invoked it passes the first CLI arg as "taskName" to `invokeTask`.

*/
const main = async () => {
	const argv: Args = mri(process.argv.slice(2));

	const {
		_: [taskName, ..._],
		...namedArgs
	} = argv;
	const args = {_, ...namedArgs};

	await invokeTask(nodeFilesystem, taskName, args);
};

main(); // see `attachProcessErrorHandlers` above for why we don't catch here
