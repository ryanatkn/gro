import {stripEnd} from '@feltjs/util/string.js';

import type {Adapter} from './adapt.js';
import {copy_dist} from './helpers.js';
import {DIST_DIRNAME} from '../path/paths.js';
import type {BuildName} from '../config/build_config.js';

export interface Options {
	build_name: BuildName;
	dir?: string; // defaults to `dist/${build_name}`
}

export const create_adapter = ({
	build_name,
	dir = `${DIST_DIRNAME}/${build_name}`,
}: Options): Adapter => {
	const output_dir = stripEnd(dir, '/');
	return {
		name: 'gro_adapter_generic_build',
		adapt: async ({config, log}) => {
			const build_config = config.builds.find((b) => b.name === build_name);
			if (!build_config) {
				throw Error(`Unknown build config: ${build_name}`);
			}

			copy_dist(build_config, output_dir, log);
		},
	};
};
