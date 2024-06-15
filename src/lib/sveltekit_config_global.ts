import {init_sveltekit_config} from './sveltekit_config.js';

/**
 * The parsed SvelteKit config for the cwd, cached globally at the module level.
 */
export const sveltekit_config_global = await init_sveltekit_config(); // always load it to keep things simple ahead
