import {EMPTY_OBJECT} from '@feltjs/util/object.js';
import {stripTrailingSlash} from '@feltjs/util/path.js';

import type {Adapter} from './adapt.js';
import {ensureNojekyll, move404, type HostTarget} from './helpers.js';
import {SVELTEKIT_BUILD_DIRNAME} from '../path/paths.js';

export interface Options {
	dir: string;
	hostTarget: HostTarget;
}

// TODO this hacks around the fact that we don't create a proper Gro build for SvelteKit frontends
export const createAdapter = ({
	dir = SVELTEKIT_BUILD_DIRNAME,
	hostTarget = 'github_pages',
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	const outputDir = stripTrailingSlash(dir);
	return {
		name: '@feltjs/gro-adapter-sveltekit-frontend',
		adapt: async ({fs}) => {
			switch (hostTarget) {
				case 'github_pages': {
					await Promise.all([ensureNojekyll(fs, outputDir), move404(fs, outputDir)]);
					break;
				}
				case 'node':
				default:
					break;
			}
		},
	};
};
