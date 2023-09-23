import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {validate_task_module, load_task_module, load_task_modules} from './task_module.js';
import * as actual_test_task_module from './test.task.js';

// TODO if we import directly, svelte-package generates types in `src/fixtures`
/* eslint-disable no-useless-concat */
const test_task_module = await import('../fixtures/' + 'test_task_module.task_fixture');
const test_invalid_task_module = await import('../fixtures/' + 'test_invalid_task_module.js');

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
	const name = 'fixtures/test_task_module.task_fixture.js';
	const id = resolve('src/' + name);
	const result = await load_task_module(id);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.id, id);
	assert.is(result.mod.name, id); // TODO was `name` but changed after scoping to lib, but we want to relax that restriction
	assert.is(result.mod.mod, test_task_module);
});

test__load_task_module('invalid module', async () => {
	const id = resolve('src/fixtures/test_invalid_task_module.js');
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
	const id = resolve('src/fixtures/test_failing_task_module.js');
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
