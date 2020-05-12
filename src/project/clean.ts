import {pathExists, emptyDir} from '../fs/nodeFs.js';
import {paths} from '../paths.js';
import {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';

export const clean = async (log: SystemLogger) => {
	await cleanBuild(log);
	await cleanDist(log);
};

// Checking `pathExists` avoids creating the directory if it doesn't exist.
export const cleanBuild = async (log: SystemLogger) => {
	if (await pathExists(paths.build)) {
		log.info('emptying', printPath(paths.build));
		await emptyDir(paths.build);
	}
};

export const cleanDist = async (log: SystemLogger) => {
	if (await pathExists(paths.dist)) {
		log.info('emptying', printPath(paths.dist));
		await emptyDir(paths.dist);
	}
};
