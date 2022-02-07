import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import {stripTrailingSlash} from '@feltcoop/felt/util/path.js';

import {type Adapter} from './adapt.js';
import {ensureNojekyll, move404, type HostTarget} from './utils.js';
import {DIST_DIRNAME, SVELTEKIT_BUILD_DIRNAME, SVELTEKIT_DIST_DIRNAME} from '../paths.js';

export interface Options {
	dir: string;
	sveltekitDir: string;
	hostTarget: HostTarget;
	deploymentMode: 'server' | 'middleware' | 'both'; // TODO hacky option that works around `@sveltejs/adapter-node`'s lack of configurable outputs
}

// TODO this hacks around the fact that we don't create a proper Gro build for SvelteKit frontends
export const createAdapter = ({
	dir = `${DIST_DIRNAME}/${SVELTEKIT_DIST_DIRNAME}`,
	sveltekitDir = SVELTEKIT_BUILD_DIRNAME,
	hostTarget = 'githubPages',
	deploymentMode = 'middleware',
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	const outputDir = stripTrailingSlash(dir);
	return {
		name: '@feltcoop/groAdapterSveltekitFrontend',
		adapt: async ({fs}) => {
			await fs.copy(sveltekitDir, outputDir);

			switch (hostTarget) {
				case 'githubPages': {
					await Promise.all([ensureNojekyll(fs, outputDir), move404(fs, outputDir)]);
					break;
				}
				case 'node': {
					if (deploymentMode === 'middleware') {
						await fs.remove(`${outputDir}/index.js`);
					} else if (deploymentMode === 'server') {
						await fs.remove(`${outputDir}/middlewares.js`);
					}
					break;
				}
				default:
					break;
			}
		},
	};
};
