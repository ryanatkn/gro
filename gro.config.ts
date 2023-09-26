import {create_empty_config} from './src/lib/config.js';

/**
 * This is the config for the Gro project itself.
 * The default config for dependent projects is located at `./lib/gro.config.default.ts`.
 * The default should be referenced as an example implementation, not this one.
 * We use different patterns here for demonstration purposes.
 */
const config = create_empty_config();

config.plugins = async () => [
	(await import('./src/lib/gro_plugin_library.js')).plugin(),
	(await import('./src/lib/gro_plugin_sveltekit_frontend.js')).plugin(),
	// TODO replace with an esbuild plugin, see the module for more
	// (await import('./lib/gro_plugin_gen.js')).plugin(),
];

export default config;
