import type {Adapter} from './adapter.js';
import {Timings} from '../utils/time.js';
import {DIST_DIRNAME, SVELTE_KIT_BUILD_DIRNAME} from '../paths.js';
import {spawnProcess} from '../utils/process.js';
import {printTimings} from '../utils/print.js';

// TODO name? is it actually specific to frontends? or is this more about bundling?

export const createAdapter = (): Adapter => {
	return {
		name: '@feltcoop/gro-adapter-sveltekit-frontend',
		begin: async ({fs}) => {
			await fs.remove(DIST_DIRNAME);
		},
		adapt: async ({fs, log}) => {
			const timings = new Timings();

			// Handle any SvelteKit build.
			const timingToBuildSvelteKit = timings.start('build SvelteKit');
			await spawnProcess('npx', ['svelte-kit', 'build']);
			timingToBuildSvelteKit();

			const timingToBuild = timings.start('copy build');
			await fs.move(SVELTE_KIT_BUILD_DIRNAME, DIST_DIRNAME);
			timingToBuild();

			printTimings(timings, log);
		},
	};
};
