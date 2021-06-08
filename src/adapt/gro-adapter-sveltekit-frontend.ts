import {Timings} from '@feltcoop/felt/utils/time.js';
import {spawn_process} from '@feltcoop/felt/utils/process.js';
import {print_timings} from '@feltcoop/felt/utils/print.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';
import {strip_trailing_slash} from '@feltcoop/felt/utils/path.js';

import type {Adapter} from './adapter.js';
import {DIST_DIRNAME, SVELTE_KIT_BUILD_DIRNAME} from '../paths.js';

const NOJEKYLL = '.nojekyll';
const DEFAULT_TARGET = 'github_pages';

export interface Options {
	dir: string;
	svelteKitDir: string;
	target: 'github_pages' | 'static';
}

export const create_adapter = ({
	dir = DIST_DIRNAME,
	svelteKitDir = SVELTE_KIT_BUILD_DIRNAME,
	target = DEFAULT_TARGET,
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = strip_trailing_slash(dir);
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		begin: async ({fs}) => {
			await fs.remove(dir);
		},
		adapt: async ({fs, log}) => {
			const timings = new Timings();

			const timingToBuildSvelteKit = timings.start('build SvelteKit');
			await spawn_process('npx', ['svelte-kit', 'build']);
			timingToBuildSvelteKit();

			const timingToCopyDist = timings.start('copy build to dist');
			await fs.move(svelteKitDir, dir);
			timingToCopyDist();

			// GitHub pages processes everything with Jekyll by default,
			// breaking things like files and dirs prefixed with an underscore.
			// This adds a `.nojekyll` file to the root of the output
			// to tell GitHub Pages to treat the outputs as plain static files.
			if (target === 'github_pages') {
				const nojekyllPath = `${dir}/${NOJEKYLL}`;
				if (!(await fs.exists(nojekyllPath))) {
					await fs.writeFile(nojekyllPath, '', 'utf8');
				}
			}

			print_timings(timings, log);
		},
	};
};
