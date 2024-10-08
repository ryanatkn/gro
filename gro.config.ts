// TODO see below
// import {gro_plugin_moss} from '@ryanatkn/moss/gro_plugin_moss.js';

import {create_empty_gro_config} from './src/lib/gro_config.js';
import {gro_plugin_sveltekit_library} from './src/lib/gro_plugin_sveltekit_library.js';
import {gro_plugin_sveltekit_app} from './src/lib/gro_plugin_sveltekit_app.js';
import {gro_plugin_gen} from './src/lib/gro_plugin_gen.js';

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
	// TODO how to do this? moss imports gro, so it needs to exist in node_modules,
	// maybe the fix is to add an exception for gro in the loader if the project is gro?
	// gro_plugin_moss() as any,
	gro_plugin_gen(),
];

export default config;
