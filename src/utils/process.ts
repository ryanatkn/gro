import {spawn} from 'child_process';
import type {SpawnOptions, ChildProcess} from 'child_process';

import {red} from '../utils/terminal.js';
import {TaskError} from '../task/task.js';
import {SystemLogger} from './log.js';
import {printError} from './print.js';
import {wait} from './async.js';

// TODO refactor
export const globalSpawn: Set<ChildProcess> = new Set();
export const registerGlobalSpawn = (child: ChildProcess): (() => void) => {
	if (globalSpawn.has(child)) throw Error(`Already registered global spawn: ${child}`);
	globalSpawn.add(child);
	return () => {
		if (!globalSpawn.has(child)) throw Error(`Spawn not registered: ${child}`);
		globalSpawn.delete(child);
	};
};

export const attachProcessErrorHandlers = () => {
	process.on('uncaughtException', handleError).on('unhandledRejection', handleUnhandledRejection);
};

export const handleError = (err: Error, label = 'handleError'): void => {
	const log = new SystemLogger([red(`[${label}]`)]);
	log.error(printError(err));
	for (const spawn of globalSpawn) {
		spawn.kill(); // TODO mabye `waitForKill()`?
	}
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

// This is just a convenient promise wrapper around `child_process.spawn`
// that's intended for commands that have an end, not long running-processes.
// Any more advanced usage should use `spawn` directly.
export const spawnProcess = (
	command: string,
	args: readonly string[] = [],
	options?: SpawnOptions,
): Promise<{ok: true} | {ok: false; code: number}> =>
	new Promise((resolve) => {
		const child = spawn(command, args, {stdio: 'inherit', ...options});
		const unregister = registerGlobalSpawn(child);
		child.on('close', (code) => {
			unregister();
			resolve(code ? {ok: false, code} : {ok: true});
		});
	});

// TODO might want to expand this API for some use cases - assumes always running
export interface RestartableProcess {
	restart: () => void;
}

const DEFAULT_RESTART_DELAY = 5; // milliseconds

// This handles many concurrent `restart` calls gracefully,
// and restarts ones after the trailing call, waiting some `delay` in between.
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
	let queuedRestart = false; // do we have a queued trailing restart?
	const restart = async (): Promise<void> => {
		if (restarting) {
			queuedRestart = true;
			return restarting;
		}
		if (child) {
			restarting = new Promise<void>((resolve) => (restarted = resolve)).then(() => wait(delay));
			child.kill();
			child = null;
			await restarting;
		}
		child = spawn(command, args, {stdio: 'inherit', ...options});
		const unregister = registerGlobalSpawn(child);
		child.on('close', () => {
			unregister();
			restarting = null;
			if (restarted) restarted();
		});
		if (queuedRestart) {
			queuedRestart = false;
			await restart();
		}
	};
	restart(); // start on init
	return {restart};
};
