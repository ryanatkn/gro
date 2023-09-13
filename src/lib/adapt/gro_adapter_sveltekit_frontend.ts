import {stripEnd} from '@feltjs/util/string.js';

import type {Adapter} from './adapt.js';
import {ensure_nojekyll, type HostTarget} from './helpers.js';
import {SVELTEKIT_BUILD_DIRNAME} from '../util/paths.js';

export interface Options {
	dir: string;
	host_target: HostTarget;
}

export const create_adapter = ({
	dir = SVELTEKIT_BUILD_DIRNAME,
	host_target = 'github_pages',
}: Partial<Options> = {}): Adapter => {
	const output_dir = stripEnd(dir, '/');
	return {
		name: 'gro_adapter_sveltekit_frontend',
		adapt: async () => {
			if (host_target === 'github_pages') {
				await Promise.all([ensure_nojekyll(output_dir)]);
			}
		},
	};
};
