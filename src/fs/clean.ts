import {EMPTY_ARRAY} from '@feltcoop/felt/utils/array.js';
import type {System_Logger} from '@feltcoop/felt/utils/log.js';

import {to_source_meta_dir} from '../build/source_meta.js';
import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTEKIT_DEV_DIRNAME,
	SVELTEKIT_BUILD_DIRNAME,
	to_build_out_dir,
	SVELTEKIT_VITE_CACHE_PATH,
	print_path,
} from '../paths.js';
import type {Filesystem} from './filesystem.js';

export const clean = async (
	fs: Filesystem,
	{
		build = false,
		build_dev = false,
		build_prod = false,
		dist = false,
		sveltekit = false,
		nodemodules = false,
	}: {
		build?: boolean;
		build_dev?: boolean;
		build_prod?: boolean;
		dist?: boolean;
		sveltekit?: boolean;
		nodemodules?: boolean;
	},
	log: System_Logger,
) =>
	Promise.all([
		build ? remove_dir(fs, paths.build, log) : null,
		...(!build && build_dev
			? [
					remove_dir(fs, to_build_out_dir(true), log),
					remove_dir(fs, to_source_meta_dir(paths.build, true), log),
			  ]
			: EMPTY_ARRAY),
		...(!build && build_prod
			? [
					remove_dir(fs, to_build_out_dir(false), log),
					remove_dir(fs, to_source_meta_dir(paths.build, false), log),
			  ]
			: EMPTY_ARRAY),
		dist ? remove_dir(fs, paths.dist, log) : null,
		...(sveltekit
			? [
					remove_dir(fs, SVELTEKIT_DEV_DIRNAME, log),
					remove_dir(fs, SVELTEKIT_BUILD_DIRNAME, log),
					remove_dir(fs, SVELTEKIT_VITE_CACHE_PATH, log),
			  ]
			: EMPTY_ARRAY),
		nodemodules ? remove_dir(fs, NODE_MODULES_DIRNAME, log) : null,
	]);

export const remove_dir = async (
	fs: Filesystem,
	path: string,
	log: System_Logger,
): Promise<void> => {
	if (await fs.exists(path)) {
		log.info('removing', print_path(path));
		await fs.remove(path);
	}
};
