import {z} from 'zod';
import {spawn} from '@ryanatkn/belt/process.js';
import {rm} from 'fs/promises';

import {Task_Error, type Task} from './task.js';
import {LOCKFILE_FILENAME, NODE_MODULES_DIRNAME} from './path_constants.js';

export const Args = z.object({}).strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: `refreshes ${LOCKFILE_FILENAME} with the latest and cleanest deps`,
	Args,
	run: async ({log}): Promise<void> => {
		log.info('running the initial npm install');
		const initial_install_result = await spawn('npm', ['i']);
		if (!initial_install_result.ok) {
			throw new Task_Error('failed initial npm install');
		}

		// Deleting both the lockfile and node_modules upgrades to the latest minor/patch versions.
		await Promise.all([rm(LOCKFILE_FILENAME), rm(NODE_MODULES_DIRNAME, {recursive: true})]);
		log.info(
			`running npm install after deleting ${LOCKFILE_FILENAME} and ${NODE_MODULES_DIRNAME}, this can take a while...`,
		);
		const second_install_result = await spawn('npm', ['i']);
		if (!second_install_result.ok) {
			throw new Task_Error(
				`failed npm install after deleting ${LOCKFILE_FILENAME} and ${NODE_MODULES_DIRNAME}`,
			);
		}

		// Deleting the lockfile and reinstalling cleans the lockfile of unnecessary dep noise,
		// like esbuild's many packages for each platform.
		await rm(LOCKFILE_FILENAME);
		log.info(`running npm install one last time to clean ${LOCKFILE_FILENAME}`);
		const final_install_result = await spawn('npm', ['i']);
		if (!final_install_result.ok) {
			throw new Task_Error('failed npm install');
		}
	},
};
