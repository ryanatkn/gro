import {Timings} from '@feltcoop/felt/util/time.js';
import {print_timings} from '@feltcoop/felt/util/print.js';
import {strip_trailing_slash} from '@feltcoop/felt/util/path.js';

import type {Adapter} from './adapter.js';
import type {Host_Target} from './utils.js';
import {copy_dist, ensure_nojekyll} from './utils.js';
import {DIST_DIRNAME} from '../paths.js';
import type {Build_Name} from '../build/build_config.js';

export interface Options {
	build_name: Build_Name;
	dir?: string; // defaults to `dist/${build_name}`
	host_target?: Host_Target;
}

export const create_adapter = ({
	build_name,
	dir = `${DIST_DIRNAME}/${build_name}`,
	host_target = 'static',
}: Options): Adapter => {
	dir = strip_trailing_slash(dir);
	return {
		name: '@feltcoop/gro-adapter-generic-build',
		adapt: async ({config, fs, dev, log}) => {
			await fs.remove(dir);

			const timings = new Timings(); // TODO probably move to task context

			const build_config = config.builds.find((b) => b.name === build_name);
			if (!build_config) {
				throw Error(`Unknown build config: ${build_name}`);
			}

			const timing_to_copy_dist = timings.start('copy builds to dist');
			await copy_dist(fs, build_config, dev, dir, log);
			timing_to_copy_dist();

			if (host_target === 'github_pages') {
				await ensure_nojekyll(fs, dir);
			}

			print_timings(timings, log);
		},
	};
};
