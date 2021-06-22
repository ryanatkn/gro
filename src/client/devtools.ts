import {Gro_Devtools} from './Gro_Devtools.js';
import {test_absolute_import} from '$lib/test_absolute_import.js';

console.log('devtools test_absolute_import', test_absolute_import);

declare global {
	namespace globalThis {
		var gro: Gro_Devtools;
	}
}

globalThis.gro = new Gro_Devtools();
