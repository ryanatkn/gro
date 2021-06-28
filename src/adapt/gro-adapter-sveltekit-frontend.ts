import {Timings} from '@feltcoop/felt/util/time.js';
import {spawn_process} from '@feltcoop/felt/util/process.js';
import {print_timings} from '@feltcoop/felt/util/print.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import {strip_trailing_slash} from '@feltcoop/felt/util/path.js';

import type {Adapter} from './adapter.js';
import {DIST_DIRNAME, SVELTEKIT_BUILD_DIRNAME, SVELTEKIT_DIST_DIRNAME} from '../paths.js';

const NOJEKYLL = '.nojekyll';
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
			await fs.remove(dir); // TODO is this right?

			const timings = new Timings();

			const timing_to_build_sveltekit = timings.start('build SvelteKit');
			await spawn_process('npx', ['svelte-kit', 'build']);
			timing_to_build_sveltekit();

			const timing_to_copy_dist = timings.start('copy build to dist');
			await fs.move(sveltekit_dir, dir);
			timing_to_copy_dist();

			// GitHub pages processes everything with Jekyll by default,
			// breaking things like files and dirs prefixed with an underscore.
			// This adds a `.nojekyll` file to the root of the output
			// to tell GitHub Pages to treat the outputs as plain static files.
			if (target === 'github_pages') {
				const nojekyll_path = `${dir}/${NOJEKYLL}`;
				if (!(await fs.exists(nojekyll_path))) {
					await fs.write_file(nojekyll_path, '', 'utf8');
				}
			}

			print_timings(timings, log);
		},
	};
};
