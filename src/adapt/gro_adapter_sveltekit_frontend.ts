import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import {strip_trailing_slash} from '@feltcoop/felt/util/path.js';

import type {Adapter} from 'src/adapt/adapt.js';
import type {HostTarget} from 'src/adapt/utils.js';
import {ensure_nojekyll} from './utils.js';
import {DIST_DIRNAME, SVELTEKIT_BUILD_DIRNAME, SVELTEKIT_DIST_DIRNAME} from '../paths.js';

export interface Options {
	dir: string;
	sveltekit_dir: string;
	host_target: HostTarget;
}

// TODO this hacks around the fact that we don't create a proper Gro build for SvelteKit frontends
export const create_adapter = ({
	dir = `${DIST_DIRNAME}/${SVELTEKIT_DIST_DIRNAME}`,
	sveltekit_dir = SVELTEKIT_BUILD_DIRNAME,
	host_target = 'github_pages',
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = strip_trailing_slash(dir);
	return {
		name: '@feltcoop/gro_adapter_sveltekit_frontend',
		adapt: async ({fs}) => {
			await fs.remove(dir);

			await fs.copy(sveltekit_dir, dir);

			if (host_target === 'github_pages') {
				await ensure_nojekyll(fs, dir);
			}
		},
	};
};
