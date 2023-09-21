import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {validate_task_module, load_task_module, load_task_modules} from './task_module.js';
import * as actual_test_task_module from './test.task.js';
import * as test_task_module from './fixtures/test_task_module.taskFixture.js';
import * as test_invalid_task_module from './fixtures/test_invalid_task_module.js';

/* test__validate_task_module */
const test__validate_task_module = suite('validate_task_module');

test__validate_task_module('basic behavior', () => {
	assert.ok(validate_task_module(test_task_module));
	assert.ok(!validate_task_module(test_invalid_task_module));
	assert.ok(!validate_task_module({task: {run: {}}}));
});

test__validate_task_module.run();
/* test__validate_task_module */

/* test__load_task_module */
const test__load_task_module = suite('load_task_module');

test__load_task_module('basic behavior', async () => {
	const name = 'task/fixtures/test_task_module.taskFixture.js';
	const id = resolve('src/lib/' + name);
	const result = await load_task_module(id);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.id, id);
	assert.is(result.mod.name, name);
	assert.is(result.mod.mod, test_task_module);
});

test__load_task_module('invalid module', async () => {
	const id = resolve('src/lib/fixtures/test_invalid_task_module.js');
	const result = await load_task_module(id);
	assert.ok(!result.ok);
	if (result.type === 'invalid') {
		assert.is(result.id, id);
		assert.is(result.mod, test_invalid_task_module);
		assert.is(result.validation, 'validate_task_module');
	} else {
		throw Error('should be invalid');
	}
});

test__load_task_module('failing module', async () => {
	const id = resolve('src/lib/fixtures/testFailingTaskModule.js');
	const result = await load_task_module(id);
	assert.ok(!result.ok);
	if (result.type === 'importFailed') {
		assert.is(result.id, id);
		assert.ok(result.error);
	} else {
		throw Error('should have failed');
	}
});

test__load_task_module.run();
/* test__load_task_module */

/* test__load_task_modules */
const test__load_task_modules = suite('load_task_modules');

test__load_task_modules('basic behavior', async () => {
	const result = await load_task_modules([
		resolve('src/lib/test'),
		resolve('src/lib/test.task.ts'),
	]);
	assert.ok(result.ok);
	assert.is(result.modules.length, 1);
	assert.is(result.modules[0].mod, actual_test_task_module);
});

test__load_task_modules.run();
/* test__load_task_modules */
