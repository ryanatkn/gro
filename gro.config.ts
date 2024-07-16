import {create_empty_gro_config} from './src/lib/config.js';
import {gro_plugin_sveltekit_library} from './src/lib/gro_plugin_sveltekit_library.js';
import {gro_plugin_sveltekit_app} from './src/lib/gro_plugin_sveltekit_app.js';

/**
 * This is the config for the Gro project itself.
 * The default config for dependent projects is located at `./lib/gro.config.default.ts`.
 * The default should be referenced as an example implementation, not this one.
 * We use different patterns here for demonstration purposes.
 */
const config = create_empty_gro_config();

config.plugins = () => [
	gro_plugin_sveltekit_library(),
	gro_plugin_sveltekit_app(),
	// TODO replace with an esbuild plugin, see the module for more
	// import {gro_plugin_gen} from './gro_plugin_gen.js';
	// gro_plugin_gen(),
];

export default config;
