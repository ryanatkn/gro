import type {SpawnOptions} from 'child_process';
import type {Spawned_Process} from '@feltcoop/felt/util/process.js';
import {spawn} from '@feltcoop/felt/util/process.js';

// TODO might want to expand this API for some use cases - assumes always running
export interface Restartable_Process {
	restart: () => void;
	kill: () => Promise<void>;
}

// Handles many concurrent `restart` calls gracefully.
export const spawn_restartable_process = (
	command: string,
	args: readonly string[] = [],
	options?: SpawnOptions,
): Restartable_Process => {
	let spawned: Spawned_Process | null = null;
	let restarting: Promise<any> | null = null;
	const close = async (): Promise<void> => {
		if (!spawned) return;
		restarting = spawned.closed;
		spawned.child.kill();
		spawned = null;
		await restarting;
		restarting = null;
	};
	const restart = async (): Promise<void> => {
		if (restarting) return restarting;
		await close();
		spawned = spawn(command, args, {stdio: 'inherit', ...options});
	};
	const kill = async (): Promise<void> => {
		if (restarting) await restarting;
		if (!spawned) return;
		await close();
	};
	restart(); // start on init
	return {restart, kill};
};
