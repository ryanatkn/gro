import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {validateTaskModule, loadTaskModule, loadTaskModules} from './taskModule.js';
import * as actualTestTaskModule from '../test.task.js';
import * as testTaskModule from './fixtures/testTaskModule.taskFixture.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';
import {fs} from '../fs/node.js';

/* test__validateTaskModule */
const test__validateTaskModule = suite('validateTaskModule');

test__validateTaskModule('basic behavior', () => {
	assert.ok(validateTaskModule(testTaskModule));
	assert.ok(!validateTaskModule(testInvalidTaskModule));
	assert.ok(!validateTaskModule({task: {run: {}}}));
});

test__validateTaskModule.run();
/* test__validateTaskModule */

/* test__loadTaskModule */
const test__loadTaskModule = suite('loadTaskModule');

test__loadTaskModule('basic behavior', async () => {
	const name = 'task/fixtures/testTaskModule.taskFixture.js';
	const id = resolve('src/lib/' + name);
	const result = await loadTaskModule(id, true);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.id, id);
	assert.is(result.mod.name, name);
	assert.is(result.mod.mod, testTaskModule);
});

test__loadTaskModule('invalid module', async () => {
	const id = resolve('src/lib/task/fixtures/testInvalidTaskModule.js');
	const result = await loadTaskModule(id, true);
	assert.ok(!result.ok);
	if (result.type === 'invalid') {
		assert.is(result.id, id);
		assert.is(result.mod, testInvalidTaskModule);
		assert.is(result.validation, 'validateTaskModule');
	} else {
		throw Error('should be invalid');
	}
});

test__loadTaskModule('failing module', async () => {
	const id = resolve('src/lib/task/fixtures/testFailingTaskModule.js');
	const result = await loadTaskModule(id, true);
	assert.ok(!result.ok);
	if (result.type === 'importFailed') {
		assert.is(result.id, id);
		assert.ok(result.error);
	} else {
		throw Error('should have failed');
	}
});

test__loadTaskModule.run();
/* test__loadTaskModule */

/* test__loadTaskModules */
const test__loadTaskModules = suite('loadTaskModules');

test__loadTaskModules('basic behavior', async () => {
	const result = await loadTaskModules(fs, [resolve('src/lib/test'), resolve('src/lib/test.task.ts')]);
	assert.ok(result.ok);
	assert.is(result.modules.length, 1);
	assert.is(result.modules[0].mod, actualTestTaskModule);
});

test__loadTaskModules.run();
/* test__loadTaskModules */
