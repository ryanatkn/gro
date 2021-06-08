// handle uncaught errors
import {attach_process_error_handlers} from '../utils/process.js';
attach_process_error_handlers();

import mri from 'mri';

import type {Args} from '../task/task.js';
import {invoke_task} from '../task/invoke_task.js';
import {fs as node_fs} from '../fs/node.js';

/*

This module invokes the Gro CLI which in turn invokes tasks.
Tasks are the CLI's primary concept.
To learn more about them, see the docs at `src/task/README.md`.

When the CLI is invoked it passes the first CLI arg as "task_name" to `invoke_task`.

*/
const main = async () => {
	const argv: Args = mri(process.argv.slice(2));

	// install sourcemaps
	if (process.env.NODE_ENV !== 'production') {
		const sourcemap_support = await import('source-map-support');
		sourcemap_support.install({
			handleUncaughtExceptions: false,
		});
	}

	const {
		_: [task_name, ..._],
		...named_args
	} = argv;
	const args = {_, ...named_args};

	await invoke_task(node_fs, task_name, args);
};

main(); // see `attach_process_error_handlers` above for why we don't catch here
