import {spawn} from 'child_process';
import type {SpawnOptions, ChildProcess} from 'child_process';

import {red} from '../utils/terminal.js';
import {TaskError} from '../task/task.js';
import {SystemLogger} from './log.js';
import {printError} from './print.js';
import {wait} from './async.js';

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

const DEFAULT_RESTART_DELAY = 5; // milliseconds

// This needs to handle many concurrent `restart` calls gracefully,
// and restart after the trailing call.
// It's slightly more complex because `kill` is sync, so we tie things up with promises.
export const createRestartableProcess = (
	command: string,
	args: readonly string[] = [],
	options?: SpawnOptions,
	delay = DEFAULT_RESTART_DELAY, // milliseconds to wait after killing a process before restarting
): RestartableProcess => {
	let child: ChildProcess | null = null;
	let restarting: Promise<void> | null = null;
	let restarted: (() => void) | null = null;
	const restart = async (): Promise<void> => {
		if (restarting) console.log('[restart] already restarting');
		if (restarting) {
			// TODO queue another for the final restart
			return restarting;
		}
		if (child) {
			restarting = new Promise<void>((resolve) => (restarted = resolve)).then(() => wait(delay));
			child.kill();
			child = null;
			console.log('[restart] awaiting');
			await restarting;
			console.log('[restart] awaited');
		}
		child = spawn(command, args, {stdio: 'inherit', ...options});
		child.on('close', () => {
			console.log('[restart] close');
			restarting = null;
			if (restarted) console.log('[restart] close restarting');
			if (restarted) restarted();
		});
	};
	restart(); // start on init
	return {restart};
};
