import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve} from 'path';

import {validateTaskModule, loadTaskModule, loadTaskModules} from './taskModule.js';
import * as actualTestTaskModule from '../test.task.js';
import * as testTaskModule from './fixtures/testTaskModule.taskFixture.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';
import {fs} from '../fs/node.js';

/* testValidateTaskModule */
const testValidateTaskModule = suite('validateTaskModule');

testValidateTaskModule('basic behavior', () => {
	t.ok(validateTaskModule(testTaskModule));
	t.not.ok(validateTaskModule(testInvalidTaskModule));
	t.not.ok(validateTaskModule({task: {run: {}}}));
});

testValidateTaskModule.run();
/* /testValidateTaskModule */

/* testLoadTaskModule */
const testLoadTaskModule = suite('loadTaskModule');

testLoadTaskModule('basic behavior', async () => {
	const name = 'task/fixtures/testTaskModule.taskFixture.js';
	const id = resolve('src/' + name);
	const result = await loadTaskModule(id, true);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.id, id);
	t.is(result.mod.name, name);
	t.is(result.mod.mod, testTaskModule);
});

testLoadTaskModule('invalid module', async () => {
	const id = resolve('src/task/fixtures/testInvalidTaskModule.js');
	const result = await loadTaskModule(id, true);
	t.not.ok(result.ok);
	if (result.type === 'invalid') {
		t.is(result.id, id);
		t.is(result.mod, testInvalidTaskModule);
		t.is(result.validation, 'validateTaskModule');
	} else {
		throw Error('should be invalid');
	}
});

testLoadTaskModule('failing module', async () => {
	const id = resolve('src/task/fixtures/testFailingTaskModule.js');
	const result = await loadTaskModule(id, true);
	t.not.ok(result.ok);
	if (result.type === 'importFailed') {
		t.is(result.id, id);
		t.ok(result.error);
	} else {
		throw Error('should have failed');
	}
});

testLoadTaskModule.run();
/* /testLoadTaskModule */

/* testLoadTaskModules */
const testLoadTaskModules = suite('loadTaskModules');

testLoadTaskModules('basic behavior', async () => {
	const result = await loadTaskModules(fs, [resolve('src/test'), resolve('src/test.task.ts')]);
	t.ok(result.ok);
	t.is(result.modules.length, 1);
	t.is(result.modules[0].mod, actualTestTaskModule);
});

testLoadTaskModules.run();
/* /testLoadTaskModules */
