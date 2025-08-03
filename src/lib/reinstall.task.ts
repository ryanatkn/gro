import {z} from 'zod';
import {spawn} from '@ryanatkn/belt/process.js';
import {rm} from 'node:fs/promises';

import {Task_Error, type Task} from './task.ts';
import {LOCKFILE_FILENAME, NODE_MODULES_DIRNAME} from './constants.ts';

export const Args = z.strictObject({});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: `refreshes ${LOCKFILE_FILENAME} with the latest and cleanest deps`,
	Args,
	run: async ({log, config}): Promise<void> => {
		log.info(`running the initial \`${config.pm_cli} install\``);
		const initial_install_result = await spawn(config.pm_cli, ['install']);
		if (!initial_install_result.ok) {
			throw new Task_Error(`Failed initial \`${config.pm_cli} install\``);
		}

		// Deleting both the lockfile and node_modules upgrades to the latest minor/patch versions.
		await Promise.all([rm(LOCKFILE_FILENAME), rm(NODE_MODULES_DIRNAME, {recursive: true})]);
		log.info(
			`running \`${config.pm_cli} install\` after deleting ${LOCKFILE_FILENAME} and ${NODE_MODULES_DIRNAME}, this can take a while...`,
		);
		const second_install_result = await spawn(config.pm_cli, ['install']);
		if (!second_install_result.ok) {
			throw new Task_Error(
				`Failed \`${config.pm_cli} install\` after deleting ${LOCKFILE_FILENAME} and ${NODE_MODULES_DIRNAME}`,
			);
		}

		// TODO this relies on npm behavior that changed in v11
		// Deleting the lockfile and reinstalling cleans the lockfile of unnecessary dep noise,
		// like esbuild's many packages for each platform.
		await rm(LOCKFILE_FILENAME);
		log.info(`running \`${config.pm_cli} install\` one last time to clean ${LOCKFILE_FILENAME}`);
		const final_install_result = await spawn(config.pm_cli, ['install']);
		if (!final_install_result.ok) {
			throw new Task_Error(`Failed \`${config.pm_cli} install\``);
		}
	},
};
