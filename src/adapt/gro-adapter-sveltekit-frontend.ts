import {Timings} from '@feltcoop/felt/util/time.js';
import {print_timings} from '@feltcoop/felt/util/print.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import {strip_trailing_slash} from '@feltcoop/felt/util/path.js';

import type {Adapter} from './adapter.js';
import {ensure_nojekyll} from './utils.js';
import {DIST_DIRNAME, SVELTEKIT_BUILD_DIRNAME, SVELTEKIT_DIST_DIRNAME} from '../paths.js';

const DEFAULT_TARGET = 'github_pages';

export interface Options {
	dir: string;
	sveltekit_dir: string;
	target: 'github_pages' | 'static';
}

// TODO this hacks around the fact that we don't create a proper Gro build for SvelteKit frontends
export const create_adapter = ({
	dir = `${DIST_DIRNAME}/${SVELTEKIT_DIST_DIRNAME}`,
	sveltekit_dir = SVELTEKIT_BUILD_DIRNAME,
	target = DEFAULT_TARGET,
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = strip_trailing_slash(dir);
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		adapt: async ({fs, log}) => {
			await fs.remove(dir);

			const timings = new Timings();

			const timing_to_copy_dist = timings.start('copy build to dist');
			await fs.copy(sveltekit_dir, dir);
			timing_to_copy_dist();

			if (target === 'github_pages') {
				await ensure_nojekyll(fs, dir);
			}

			print_timings(timings, log);
		},
	};
};
