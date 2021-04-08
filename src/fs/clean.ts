import {pathExists, remove} from '../fs/node.js';
import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTE_KIT_DEV_DIRNAME,
	SVELTE_KIT_BUILD_DIRNAME,
} from '../paths.js';
import {EMPTY_ARRAY} from '../utils/array.js';
import type {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';

export const clean = async (
	{
		build = false,
		dist = false,
		svelteKit = false,
		nodeModules = false,
	}: {build?: boolean; dist?: boolean; svelteKit?: boolean; nodeModules?: boolean},
	log: SystemLogger,
) =>
	Promise.all([
		build ? cleanDir(paths.build, log) : null,
		dist ? cleanDir(paths.dist, log) : null,
		...(svelteKit
			? [cleanDir(SVELTE_KIT_DEV_DIRNAME, log), cleanDir(SVELTE_KIT_BUILD_DIRNAME, log)]
			: EMPTY_ARRAY),
		nodeModules ? cleanDir(NODE_MODULES_DIRNAME, log) : null,
	]);

export const cleanDir = async (path: string, log: SystemLogger): Promise<void> => {
	if (await pathExists(path)) {
		log.info('removing', printPath(path));
		await remove(path);
	}
};
