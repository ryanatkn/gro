import {spawn, SpawnOptions, ChildProcess} from 'child_process';

import {red} from '../utils/terminal.js';
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

// TODO might want to expand this API for some use cases - assumes always running
export interface RestartableProcess {
	restart: () => void;
}

export const createRestartableProcess = (serverPath: string): RestartableProcess => {
	let serverProcess: ChildProcess | null = null;
	let serverClosed: Promise<void> | null = null; // `kill` is sync; this resolves when it's done
	const restart = async (): Promise<void> => {
		if (serverClosed) {
			if (serverProcess) {
				serverProcess.kill();
				serverProcess = null;
			}
			await serverClosed;
		}
		serverProcess = spawn('node', [serverPath], {stdio: 'inherit'});
		let resolve: () => void;
		serverClosed = new Promise((r) => (resolve = r));
		serverProcess.on('close', resolve!);
	};
	restart(); // start on init
	return {restart};
};
