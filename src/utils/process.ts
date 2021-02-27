import {spawn, SpawnOptions} from 'child_process';

import {red} from '../colors/terminal.js';
import {TaskError} from '../task/task.js';
import {SystemLogger} from './log.js';
import {printError} from './print.js';

export const attachProcessErrorHandlers = () => {
	process.on('uncaughtException', handleError).on('unhandledRejection', handleUnhandledRejection);
};

export const handleError = (err: Error, label = 'handleError'): void => {
	const log = new SystemLogger([red(`[${label}]`)]);
	log.error(printError(err));
	process.exit(1);
};

const handleUnhandledRejection = (err: Error | any): void => {
	if (err instanceof TaskError) {
		handleError(err, 'TaskError');
	} else if (err instanceof Error) {
		handleError(err, 'unhandledRejection');
	} else {
		handleError(new Error(err), 'unhandledRejection');
	}
};

// This is just a convenient promise wrapper around `child_process.spawn`.
// Any more advanced usage should use `spawn` directly.
export const spawnProcess = (
	command: string,
	args: readonly string[] = [],
	options?: SpawnOptions,
): Promise<{ok: true} | {ok: false; code: number}> =>
	new Promise((resolve) => {
		const childProcess = spawn(command, args, {stdio: 'inherit', ...options});
		childProcess.on('close', (code) => {
			resolve(code ? {ok: false, code} : {ok: true});
		});
	});
