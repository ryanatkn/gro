import {EMPTY_ARRAY} from '@feltcoop/util/array.js';
import type {SystemLogger} from '@feltcoop/util/log.js';

import {toSourceMetaDir} from '../build/sourceMeta.js';
import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTEKIT_DEV_DIRNAME,
	SVELTEKIT_BUILD_DIRNAME,
	toBuildOutDir,
	SVELTEKIT_VITE_CACHE_PATH,
	printPath,
} from '../paths.js';
import type {Filesystem} from './filesystem.js';

export const cleanFs = async (
	fs: Filesystem,
	{
		build = false,
		buildDev = false,
		buildProd = false,
		dist = false,
		sveltekit = false,
		nodemodules = false,
	}: {
		build?: boolean;
		buildDev?: boolean;
		buildProd?: boolean;
		dist?: boolean;
		sveltekit?: boolean;
		nodemodules?: boolean;
	},
	log: SystemLogger,
): Promise<any[]> =>
	Promise.all([
		build ? removeDir(fs, paths.build, log) : null,
		...(!build && buildDev
			? [
					removeDir(fs, toBuildOutDir(true), log),
					removeDir(fs, toSourceMetaDir(paths.build, true), log),
			  ]
			: EMPTY_ARRAY),
		...(!build && buildProd
			? [
					removeDir(fs, toBuildOutDir(false), log),
					removeDir(fs, toSourceMetaDir(paths.build, false), log),
			  ]
			: EMPTY_ARRAY),
		dist ? removeDir(fs, paths.dist, log) : null,
		...(sveltekit
			? [
					removeDir(fs, SVELTEKIT_DEV_DIRNAME, log),
					removeDir(fs, SVELTEKIT_BUILD_DIRNAME, log),
					removeDir(fs, SVELTEKIT_VITE_CACHE_PATH, log),
			  ]
			: EMPTY_ARRAY),
		nodemodules ? removeDir(fs, NODE_MODULES_DIRNAME, log) : null,
	]);

export const removeDir = async (fs: Filesystem, path: string, log: SystemLogger): Promise<void> => {
	if (await fs.exists(path)) {
		log.info('removing', printPath(path));
		await fs.remove(path);
	}
};
