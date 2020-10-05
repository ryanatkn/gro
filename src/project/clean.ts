import {pathExists, remove} from '../fs/nodeFs.js';
import {paths, toBuildsDir} from '../paths.js';
import {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';

export const clean = async (log: SystemLogger) => {
	await cleanBuild(log);
	await cleanDist(log);
};

// Checking `pathExists` avoids creating the directory if it doesn't exist.
export const cleanBuild = async (log: SystemLogger) => {
	if (await pathExists(paths.build)) {
		log.info('removing', printPath(paths.build));
		await remove(paths.build);
	}
};

export const cleanProductionBuild = async (log: SystemLogger) => {
	const path = toBuildsDir(false);
	if (await pathExists(path)) {
		log.info('removing', printPath(path));
		await remove(path);
	}
};

export const cleanDist = async (log: SystemLogger) => {
	if (await pathExists(paths.dist)) {
		log.info('removing', printPath(paths.dist));
		await remove(paths.dist);
	}
};
