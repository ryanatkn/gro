import {stripTrailingSlash, EMPTY_OBJECT} from '@feltcoop/util';

import type {Adapter} from './adapt.js';
import {ensureNojekyll, move404, type HostTarget} from './utils.js';
import {DIST_DIRNAME, SVELTEKIT_BUILD_DIRNAME, SVELTEKIT_DIST_DIRNAME} from '../paths.js';

export interface Options {
	dir: string;
	sveltekitDir: string;
	hostTarget: HostTarget;
}

// TODO this hacks around the fact that we don't create a proper Gro build for SvelteKit frontends
export const createAdapter = ({
	dir = `${DIST_DIRNAME}/${SVELTEKIT_DIST_DIRNAME}`,
	sveltekitDir = SVELTEKIT_BUILD_DIRNAME,
	hostTarget = 'githubPages',
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	const outputDir = stripTrailingSlash(dir);
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		adapt: async ({fs}) => {
			await fs.copy(sveltekitDir, outputDir);

			switch (hostTarget) {
				case 'githubPages': {
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
