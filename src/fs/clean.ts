import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTE_KIT_DEV_DIRNAME,
	SVELTE_KIT_BUILD_DIRNAME,
} from '../paths.js';
import {EMPTY_ARRAY} from '../utils/array.js';
import type {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import type {Filesystem} from './filesystem.js';

export const clean = async (
	fs: Filesystem,
	{
		build = false,
		dist = false,
		svelteKit = false,
		nodeModules = false,
	}: {build?: boolean; dist?: boolean; svelteKit?: boolean; nodeModules?: boolean},
	log: SystemLogger,
) =>
	Promise.all([
		build ? cleanDir(fs, paths.build, log) : null,
		dist ? cleanDir(fs, paths.dist, log) : null,
		...(svelteKit
			? [cleanDir(fs, SVELTE_KIT_DEV_DIRNAME, log), cleanDir(fs, SVELTE_KIT_BUILD_DIRNAME, log)]
			: EMPTY_ARRAY),
		nodeModules ? cleanDir(fs, NODE_MODULES_DIRNAME, log) : null,
	]);

export const cleanDir = async (fs: Filesystem, path: string, log: SystemLogger): Promise<void> => {
	if (await fs.exists(path)) {
		log.info('removing', printPath(path));
		await fs.remove(path);
	}
};
