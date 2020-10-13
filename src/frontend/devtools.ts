import {GroDevtools} from './GroDevtools.js';

declare global {
	namespace globalThis {
		var gro: GroDevtools;
	}
}

globalThis.gro = new GroDevtools();
