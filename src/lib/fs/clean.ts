import {EMPTY_ARRAY} from '@feltjs/util/array.js';
import type {SystemLogger} from '@feltjs/util/log.js';

import {to_source_meta_dir} from '../build/source_meta.js';
import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTEKIT_DEV_DIRNAME,
	SVELTEKIT_BUILD_DIRNAME,
	to_build_out_dir,
	SVELTEKIT_VITE_CACHE_PATH,
	print_path,
} from '../path/paths.js';
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
					removeDir(fs, to_build_out_dir(true), log),
					removeDir(fs, to_source_meta_dir(paths.build, true), log),
			  ]
			: EMPTY_ARRAY),
		...(!build && buildProd
			? [
					removeDir(fs, to_build_out_dir(false), log),
					removeDir(fs, to_source_meta_dir(paths.build, false), log),
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
		log.info('removing', print_path(path));
		await fs.remove(path);
	}
};
