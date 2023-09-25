import { identity } from '@grogarden/util/function.js';

import type {GroConfig} from './src/lib/config.js';

/**
 * This is the config for the Gro project itself.
 * The default config for dependent projects is located at `./lib/gro.config.default.ts`.
 * The default should be referenced as an example implementation, not this one.
 */
const config: GroConfig = {
	package_json: identity,
	plugins: async () => [
		(await import('./src/lib/gro_plugin_library.js')).plugin(),
		(await import('./src/lib/gro_plugin_sveltekit_frontend.js')).plugin(),
		// TODO replace with an esbuild plugin, see the module for more
		// (await import('./lib/gro_plugin_gen.js')).plugin(),
	],
};

export default config;
