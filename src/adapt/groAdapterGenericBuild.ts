import {stripTrailingSlash} from '@feltcoop/felt/util/path.js';

import {type Adapter} from 'src/adapt/adapt.js';
import {type HostTarget} from 'src/adapt/utils.js';
import {copyDist, ensureNojekyll} from './utils.js';
import {DIST_DIRNAME} from '../paths.js';
import {type BuildName} from 'src/build/buildConfig.js';

export interface Options {
	buildName: BuildName;
	dir?: string; // defaults to `dist/${buildName}`
	hostTarget?: HostTarget;
}

export const createAdapter = ({
	buildName,
	dir = `${DIST_DIRNAME}/${buildName}`,
	hostTarget = 'static',
}: Options): Adapter => {
	dir = stripTrailingSlash(dir);
	return {
		name: '@feltcoop/groAdapterGenericBuild',
		adapt: async ({config, fs, dev, log}) => {
			const buildConfig = config.builds.find((b) => b.name === buildName);
			if (!buildConfig) {
				throw Error(`Unknown build config: ${buildName}`);
			}

			await copyDist(fs, buildConfig, dev, dir, log);

			if (hostTarget === 'githubPages') {
				await ensureNojekyll(fs, dir);
			}
		},
	};
};
