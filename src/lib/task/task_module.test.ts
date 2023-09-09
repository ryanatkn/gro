import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {validate_task_module, load_task_module, loadTaskModules} from './task_module.js';
import * as actualTestTaskModule from '../test.task.js';
import * as testTaskModule from './fixtures/testTaskModule.taskFixture.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';

/* test__validate_task_module */
const test__validate_task_module = suite('validate_task_module');

test__validate_task_module('basic behavior', () => {
	assert.ok(validate_task_module(testTaskModule));
	assert.ok(!validate_task_module(testInvalidTaskModule));
	assert.ok(!validate_task_module({task: {run: {}}}));
});

test__validate_task_module.run();
/* test__validate_task_module */

/* test__loadTaskModule */
const test__loadTaskModule = suite('loadTaskModule');

test__loadTaskModule('basic behavior', async () => {
	const name = 'task/fixtures/testTaskModule.taskFixture.js';
	const id = resolve('src/lib/' + name);
	const result = await load_task_module(id);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.id, id);
	assert.is(result.mod.name, name);
	assert.is(result.mod.mod, testTaskModule);
});

test__loadTaskModule('invalid module', async () => {
	const id = resolve('src/lib/task/fixtures/testInvalidTaskModule.js');
	const result = await load_task_module(id);
	assert.ok(!result.ok);
	if (result.type === 'invalid') {
		assert.is(result.id, id);
		assert.is(result.mod, testInvalidTaskModule);
		assert.is(result.validation, 'validate_task_module');
	} else {
		throw Error('should be invalid');
	}
});

test__loadTaskModule('failing module', async () => {
	const id = resolve('src/lib/task/fixtures/testFailingTaskModule.js');
	const result = await load_task_module(id);
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
	const result = await loadTaskModules([resolve('src/lib/test'), resolve('src/lib/test.task.ts')]);
	assert.ok(result.ok);
	assert.is(result.modules.length, 1);
	assert.is(result.modules[0].mod, actualTestTaskModule);
});

test__loadTaskModules.run();
/* test__loadTaskModules */
