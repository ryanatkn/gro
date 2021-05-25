import type {Adapter} from './adapter.js';
import {Timings} from '../utils/time.js';
import {DIST_DIRNAME, SVELTE_KIT_APP_DIRNAME, SVELTE_KIT_BUILD_DIRNAME} from '../paths.js';
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

			const timingToBuild = timings.start('build');

			// TODO move to a detected adapter
			// Handle any SvelteKit build.
			// TODO could parallelize this - currently puts all SvelteKit stuff first
			const timingToBuildSvelteKit = timings.start('SvelteKit build');
			await spawnProcess('npx', ['svelte-kit', 'build']);
			// TODO remove this when SvelteKit has its duplicate build dir bug fixed
			// TODO take a look at its issues/codebase for fix
			if (
				(await fs.exists(`${SVELTE_KIT_BUILD_DIRNAME}/_${SVELTE_KIT_APP_DIRNAME}`)) &&
				(await fs.exists(`${SVELTE_KIT_BUILD_DIRNAME}/${SVELTE_KIT_APP_DIRNAME}`))
			) {
				await fs.remove(`${SVELTE_KIT_BUILD_DIRNAME}/_${SVELTE_KIT_APP_DIRNAME}`);
			}
			// TODO remove this when we implement something like `adapter-felt`
			// We implement the adapting Svelte server ourselves in production,
			// so this line deletes the default Node adapter server app file.
			// The Node adapter is convenient to keep in place, and we just adjust the final `dist/`.
			await fs.remove(`${SVELTE_KIT_BUILD_DIRNAME}/index.js`);
			await fs.move(SVELTE_KIT_BUILD_DIRNAME, DIST_DIRNAME);
			timingToBuildSvelteKit();

			timingToBuild();

			printTimings(timings, log);
		},
	};
};
