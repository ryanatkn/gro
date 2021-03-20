import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve} from 'path';

import {validateTaskModule, loadTaskModule, loadTaskModules} from './taskModule.js';
import * as actualTestTaskModule from '../test.task.js';
import * as testTaskModule from './fixtures/testTaskModule.taskFixture.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';

/* test_validateTaskModule */
const test_validateTaskModule = suite('validateTaskModule');

test_validateTaskModule('basic behavior', () => {
	t.ok(validateTaskModule(testTaskModule));
	t.not.ok(validateTaskModule(testInvalidTaskModule));
	t.not.ok(validateTaskModule({task: {run: {}}}));
});

test_validateTaskModule.run();
/* /test_validateTaskModule */

/* test_loadTaskModule */
const test_loadTaskModule = suite('loadTaskModule');

test_loadTaskModule('basic behavior', async () => {
	const name = 'task/fixtures/testTaskModule.taskFixture.js';
	const id = resolve('src/' + name);
	const result = await loadTaskModule(id);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.id, id);
	t.is(result.mod.name, name);
	t.is(result.mod.mod, testTaskModule);
});

test_loadTaskModule('invalid module', async () => {
	const id = resolve('src/task/fixtures/testInvalidTaskModule.js');
	const result = await loadTaskModule(id);
	t.not.ok(result.ok);
	if (result.type === 'invalid') {
		t.is(result.id, id);
		t.is(result.mod, testInvalidTaskModule);
		t.is(result.validation, 'validateTaskModule');
	} else {
		throw Error('should be invalid');
	}
});

test_loadTaskModule('failing module', async () => {
	const id = resolve('src/task/fixtures/testFailingTaskModule.js');
	const result = await loadTaskModule(id);
	t.not.ok(result.ok);
	if (result.type === 'importFailed') {
		t.is(result.id, id);
		t.ok(result.error);
	} else {
		throw Error('should have failed');
	}
});

test_loadTaskModule.run();
/* /test_loadTaskModule */

/* test_loadTaskModules */
const test_loadTaskModules = suite('loadTaskModules');

test_loadTaskModules('basic behavior', async () => {
	const result = await loadTaskModules([resolve('src/test'), resolve('src/test.task.ts')]);
	t.ok(result.ok);
	t.is(result.modules.length, 1);
	t.is(result.modules[0].mod, actualTestTaskModule);
});

test_loadTaskModules.run();
/* /test_loadTaskModules */
