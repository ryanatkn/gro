import {join} from 'path';

import {test, t} from '../oki/oki.js';
import {validateGenModule, findGenModules} from './genModule.js';
import {paths} from '../paths.js';

test('validateGenModule()', () => {
	t.ok(validateGenModule({gen: () => {}}));

	test('invalid module', () => {
		t.ok(!validateGenModule({gen: {}}));
		t.ok(!validateGenModule({task: {run: {}}}));
	});
});

test('findGenModules()', async () => {
	const findGenModulesResult = await findGenModules([join(paths.source, 'docs/')]);
	t.ok(findGenModulesResult.ok);
});
