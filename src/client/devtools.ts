import {Gro_Devtools} from './Gro_Devtools.js';

declare global {
	namespace globalThis {
		var gro: Gro_Devtools;
	}
}

globalThis.gro = new Gro_Devtools();
