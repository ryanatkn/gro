import {rm} from 'node:fs/promises';
import type {RmOptions} from 'node:fs';

import {
	NODE_MODULES_DIRNAME,
	paths,
	SVELTEKIT_DEV_DIRNAME,
	SVELTEKIT_BUILD_DIRNAME,
	SVELTEKIT_VITE_CACHE_PATH,
} from './paths.js';

export const clean_fs = async (
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
	rm_options: RmOptions = {force: true, recursive: true},
): Promise<void> => {
	const promises: Array<Promise<void>> = [];

	if (build) {
		promises.push(rm(paths.build, rm_options));
	} else if (dist) {
		promises.push(rm(paths.dist, rm_options));
	}
	if (sveltekit) {
		promises.push(rm(SVELTEKIT_DEV_DIRNAME, rm_options));
		promises.push(rm(SVELTEKIT_BUILD_DIRNAME, rm_options));
		promises.push(rm(SVELTEKIT_VITE_CACHE_PATH, rm_options));
	}
	if (nodemodules) {
		promises.push(rm(NODE_MODULES_DIRNAME, rm_options));
	}

	await Promise.all(promises);
};
