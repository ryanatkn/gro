import {stripEnd} from '@feltjs/util/string.js';

import type {Adapter} from './adapt.js';
import {type HostTarget, copy_dist, ensure_nojekyll} from './helpers.js';
import {DIST_DIRNAME} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';

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
	const outputDir = stripEnd(dir, '/');
	return {
		name: 'gro_adapter_generic_build',
		adapt: async ({config, fs, dev, log}) => {
			const build_config = config.builds.find((b) => b.name === buildName);
			if (!build_config) {
				throw Error(`Unknown build config: ${buildName}`);
			}

			await copy_dist(fs, build_config, dev, outputDir, log);

			if (hostTarget === 'github_pages') {
				await ensure_nojekyll(fs, outputDir);
			}
		},
	};
};
