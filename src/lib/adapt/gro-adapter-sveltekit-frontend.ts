import {EMPTY_OBJECT} from '@feltjs/util/object.js';
import {stripTrailingSlash} from '@feltjs/util/path.js';

import type {Adapter} from './adapt.js';
import {ensureNojekyll, move404, type HostTarget} from './helpers.js';
import {SVELTEKIT_BUILD_DIRNAME} from '../path/paths.js';

export interface Options {
	sveltekitDir: string;
	dir: string;
	hostTarget: HostTarget;
}

// TODO this hacks around the fact that we don't create a proper Gro build for SvelteKit frontends
export const createAdapter = ({
	sveltekitDir = SVELTEKIT_BUILD_DIRNAME,
	dir = sveltekitDir,
	hostTarget = 'githubPages',
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	const outputDir = stripTrailingSlash(dir);
	const sveltekitOutputDir = stripTrailingSlash(sveltekitDir);
	return {
		name: '@feltjs/gro-adapter-sveltekit-frontend',
		adapt: async ({fs}) => {
			if (sveltekitOutputDir !== outputDir) {
				await fs.move(sveltekitOutputDir, outputDir);
			}
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
