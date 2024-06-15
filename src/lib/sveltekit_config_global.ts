import {green} from 'kleur/colors';
import {init_sveltekit_config} from './sveltekit_config.js';

// TODO BLOCK it appears we are running from the .js and then the local dir, but that only happens in Gro, which is fine, but can it easily be fixed? but it seems to be using the first of the two in modules...
console.log(green('sveltekit_config_global loaded'));

export const GLOBAL_SVELTEKIT_ID = Math.random();
console.log(
	green(
		`GLOBAL_SVELTEKIT_ID**************************************************************************************************************`,
	),
	GLOBAL_SVELTEKIT_ID,
);

/**
 * The parsed SvelteKit config for the cwd, cached globally at the module level.
 */
export const sveltekit_config_global = await init_sveltekit_config(); // always load it to keep things simple ahead
