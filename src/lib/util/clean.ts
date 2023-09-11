import type {SystemLogger} from '@feltjs/util/log.js';
import {existsSync, rmSync} from 'node:fs';

import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTEKIT_DEV_DIRNAME,
	SVELTEKIT_BUILD_DIRNAME,
	SVELTEKIT_VITE_CACHE_PATH,
	print_path,
} from '../path/paths.js';

export const clean_fs = (
	{
		build = false,
		dist = false,
		sveltekit = false,
		nodemodules = false,
	}: {
		build?: boolean;
		dist?: boolean;
		sveltekit?: boolean;
		nodemodules?: boolean;
	},
	log: SystemLogger,
): void => {
	if (build) {
		remove_dir(paths.build, log);
	} else if (dist) {
		remove_dir(paths.dist, log);
	}
	if (sveltekit) {
		remove_dir(SVELTEKIT_DEV_DIRNAME, log);
		remove_dir(SVELTEKIT_BUILD_DIRNAME, log);
		remove_dir(SVELTEKIT_VITE_CACHE_PATH, log);
	}
	if (nodemodules) {
		remove_dir(NODE_MODULES_DIRNAME, log);
	}
};

export const remove_dir = (path: string, log: SystemLogger): void => {
	if (existsSync(path)) {
		log.info('removing', print_path(path));
		rmSync(path, {recursive: true});
	}
};
