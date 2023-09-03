import {stripTrailingSlash} from '@feltjs/util/path.js';

import type {Adapter} from './adapt.js';
import {type HostTarget, copyDist, ensureNojekyll} from './helpers.js';
import {DIST_DIRNAME} from '../path/paths.js';
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
		name: 'gro-adapter-generic-build',
		adapt: async ({config, fs, dev, log}) => {
			const buildConfig = config.builds.find((b) => b.name === buildName);
			if (!buildConfig) {
				throw Error(`Unknown build config: ${buildName}`);
			}

			await copyDist(fs, buildConfig, dev, outputDir, log);

			if (hostTarget === 'github_pages') {
				await ensureNojekyll(fs, outputDir);
			}
		},
	};
};
