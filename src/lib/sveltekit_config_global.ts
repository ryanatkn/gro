import {green} from 'kleur/colors';
import {init_sveltekit_config} from './sveltekit_config.js';

// TODO why is this running twice?
console.log(green('sveltekit_config_global loaded'));

export const GLOBAL_SVELTEKIT_ID = Math.random();
console.log(
	green(
		`GLOBAL_SVELTEKIT_ID;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;`,
	),
	GLOBAL_SVELTEKIT_ID,
);

export const sveltekit_config_global = await init_sveltekit_config(); // always load it to keep things simple ahead
