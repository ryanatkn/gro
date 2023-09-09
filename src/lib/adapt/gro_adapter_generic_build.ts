import {stripEnd} from '@feltjs/util/string.js';

import type {Adapter} from './adapt.js';
import {type HostTarget, copy_dist, ensure_nojekyll} from './helpers.js';
import {DIST_DIRNAME} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';

export interface Options {
	build_name: BuildName;
	dir?: string; // defaults to `dist/${build_name}`
	host_target?: HostTarget;
}

export const create_adapter = ({
	build_name,
	dir = `${DIST_DIRNAME}/${build_name}`,
	host_target = 'static',
}: Options): Adapter => {
	const output_dir = stripEnd(dir, '/');
	return {
		name: 'gro_adapter_generic_build',
		adapt: async ({config, dev, log}) => {
			const build_config = config.builds.find((b) => b.name === build_name);
			if (!build_config) {
				throw Error(`Unknown build config: ${build_name}`);
			}

			await copy_dist(build_config, dev, output_dir, log);

			if (host_target === 'github_pages') {
				await ensure_nojekyll(output_dir);
			}
		},
	};
};
