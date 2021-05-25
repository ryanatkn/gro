import {toSourceMetaDir} from '../build/sourceMeta.js';
import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTE_KIT_DEV_DIRNAME,
	SVELTE_KIT_BUILD_DIRNAME,
	toBuildOutDir,
} from '../paths.js';
import {EMPTY_ARRAY} from '../utils/array.js';
import type {SystemLogger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import type {Filesystem} from './filesystem.js';

export const clean = async (
	fs: Filesystem,
	{
		build = false,
		buildDev = false,
		buildProd = false,
		dist = false,
		svelteKit = false,
		nodeModules = false,
	}: {
		build?: boolean;
		buildDev?: boolean;
		buildProd?: boolean;
		dist?: boolean;
		svelteKit?: boolean;
		nodeModules?: boolean;
	},
	log: SystemLogger,
) =>
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
		...(svelteKit
			? [removeDir(fs, SVELTE_KIT_DEV_DIRNAME, log), removeDir(fs, SVELTE_KIT_BUILD_DIRNAME, log)]
			: EMPTY_ARRAY),
		nodeModules ? removeDir(fs, NODE_MODULES_DIRNAME, log) : null,
	]);

export const removeDir = async (fs: Filesystem, path: string, log: SystemLogger): Promise<void> => {
	if (await fs.exists(path)) {
		log.info('removing', printPath(path));
		await fs.remove(path);
	}
};
