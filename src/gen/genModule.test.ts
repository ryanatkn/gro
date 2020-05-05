import {test, t} from '../oki/oki.js';
import {validateGenModule} from './genModule.js';

test('validateGenModule()', () => {
	t.ok(validateGenModule({gen: () => {}}));

	test('invalid module', () => {
		t.ok(!validateGenModule({gen: {}}));
		t.ok(!validateGenModule({task: {run: {}}}));
	});
});
