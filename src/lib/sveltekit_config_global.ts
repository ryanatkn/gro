import {green} from 'kleur/colors';
import {init_sveltekit_config} from './sveltekit_config.js';

console.log(green('sveltekit_config_global loaded'));

export const sveltekit_config_global = await init_sveltekit_config(); // always load it to keep things simple ahead
