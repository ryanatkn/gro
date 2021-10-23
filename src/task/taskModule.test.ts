import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'path';

import {validateTaskModule, loadTaskModule, loadTaskModules} from './taskModule.js';
import * as actualTestTaskModule from '../test.task.js';
import * as testTaskModule from './fixtures/testTaskModule.taskFixture.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';
import {fs} from '../fs/node.js';

/* testValidateTaskModule */
const testValidateTaskModule = suite('validateTaskModule');

testValidateTaskModule('basic behavior', () => {
	assert.ok(validateTaskModule(testTaskModule));
	assert.not.ok(validateTaskModule(testInvalidTaskModule));
	assert.not.ok(validateTaskModule({task: {run: {}}}));
});

testValidateTaskModule.run();
/* /testValidateTaskModule */

/* testLoadTaskModule */
const testLoadTaskModule = suite('loadTaskModule');

testLoadTaskModule('basic behavior', async () => {
	const name = 'task/fixtures/testTaskModule.taskFixture.js';
	const id = resolve('src/' + name);
	const result = await loadTaskModule(id, true);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.id, id);
	assert.is(result.mod.name, name);
	assert.is(result.mod.mod, testTaskModule);
});

testLoadTaskModule('invalid module', async () => {
	const id = resolve('src/task/fixtures/testInvalidTaskModule.js');
	const result = await loadTaskModule(id, true);
	assert.not.ok(result.ok);
	if (result.type === 'invalid') {
		assert.is(result.id, id);
		assert.is(result.mod, testInvalidTaskModule);
		assert.is(result.validation, 'validateTaskModule');
	} else {
		throw Error('should be invalid');
	}
});

testLoadTaskModule('failing module', async () => {
	const id = resolve('src/task/fixtures/testFailingTaskModule.js');
	const result = await loadTaskModule(id, true);
	assert.not.ok(result.ok);
	if (result.type === 'importFailed') {
		assert.is(result.id, id);
		assert.ok(result.error);
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
	assert.ok(result.ok);
	assert.is(result.modules.length, 1);
	assert.is(result.modules[0].mod, actualTestTaskModule);
});

testLoadTaskModules.run();
/* /testLoadTaskModules */
