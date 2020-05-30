// handle uncaught errors
import {attachProcessErrorHandlers} from '../utils/process.js';
attachProcessErrorHandlers();

// install source maps
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install({
	handleUncaughtExceptions: false,
});

// set up the env
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

import mri from 'mri';

import {Args} from './types.js';
import {invokeTask} from '../task/invokeTask.js';

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

	await invokeTask(taskName, args);
};

main(); // see `attachProcessErrorHandlers` above for why we don't catch here
