import {stripTrailingSlash} from '@feltjs/util/path.js';

import type {Adapter} from './adapt.js';
import {ensureNojekyll, type HostTarget} from './helpers.js';
import {SVELTEKIT_BUILD_DIRNAME} from '../path/paths.js';

export interface Options {
	dir: string;
	hostTarget: HostTarget;
}

export const createAdapter = ({
	dir = SVELTEKIT_BUILD_DIRNAME,
	hostTarget = 'github_pages',
}: Partial<Options> = {}): Adapter => {
	const outputDir = stripTrailingSlash(dir);
	return {
		name: '@feltjs/gro-adapter-sveltekit-frontend',
		adapt: async ({fs}) => {
			if (hostTarget === 'github_pages') {
				await Promise.all([ensureNojekyll(fs, outputDir)]);
			}
		},
	};
};
