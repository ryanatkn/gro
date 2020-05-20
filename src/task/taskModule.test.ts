import {resolve} from 'path';

import {test, t} from '../oki/oki.js';
import {validateTaskModule, loadTaskModule, loadTaskModules} from './taskModule.js';
import * as actualTestTaskModule from '../test.task.js';
import * as testTaskModule from './fixtures/testTaskModule.taskFixture.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';

test('validateTaskModule()', () => {
	t.ok(validateTaskModule(testTaskModule));
	t.ok(!validateTaskModule(testInvalidTaskModule));
	t.ok(!validateTaskModule({task: {run: {}}}));
});

test('loadTaskModule()', () => {
	test('basic behavior', async () => {
		const name = 'task/fixtures/testTaskModule.taskFixture.js';
		const id = resolve('src/' + name);
		const result = await loadTaskModule(id);
		t.ok(result.ok);
		t.is(result.mod.id, id);
		t.is(result.mod.id, id);
		t.is(result.mod.name, name);
		t.is(result.mod.mod, testTaskModule);
	});

	test('invalid module', async () => {
		const id = resolve('src/task/fixtures/testInvalidTaskModule.js');
		const result = await loadTaskModule(id);
		t.ok(!result.ok);
		if (result.type === 'invalid') {
			t.is(result.id, id);
			t.is(result.mod, testInvalidTaskModule);
			t.is(result.validation, 'validateTaskModule');
		} else {
			t.fail('should be invalid');
		}
	});

	test('failing module', async () => {
		const id = resolve('src/task/fixtures/testFailingTaskModule.js');
		const result = await loadTaskModule(id);
		t.ok(!result.ok);
		if (result.type === 'importFailed') {
			t.is(result.id, id);
			t.ok(result.error);
		} else {
			t.fail('should have failed');
		}
	});
});

test('loadTaskModules()', async () => {
	const result = await loadTaskModules([resolve('src/test'), resolve('src/test.task.ts')]);
	t.ok(result.ok);
	t.is(result.modules.length, 1);
	t.is(result.modules[0].mod, actualTestTaskModule);
});
