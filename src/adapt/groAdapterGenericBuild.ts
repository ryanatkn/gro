import {stripTrailingSlash} from '@feltcoop/felt/util/path.js';

import type {Adapter} from './adapt.js';
import {type HostTarget, copyDist, ensureNojekyll} from './utils.js';
import {DIST_DIRNAME} from '../paths.js';
import type {BuildName} from '../build/buildConfig.js';

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
	const outputDir = stripTrailingSlash(dir);
	return {
		name: '@feltcoop/groAdapterGenericBuild',
		adapt: async ({config, fs, dev, log}) => {
			const buildConfig = config.builds.find((b) => b.name === buildName);
			if (!buildConfig) {
				throw Error(`Unknown build config: ${buildName}`);
			}

			await copyDist(fs, buildConfig, dev, outputDir, log);

			if (hostTarget === 'githubPages') {
				await ensureNojekyll(fs, outputDir);
			}
		},
	};
};
