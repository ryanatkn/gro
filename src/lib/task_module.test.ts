import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {validate_task_module, find_tasks, load_tasks} from './task_module.js';
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

/* test__load_tasks */
const test__load_tasks = suite('load_tasks');

test__load_tasks('basic behavior', async () => {
	const found = await find_tasks(
		[resolve('src/lib/test'), resolve('src/lib/test.task.ts')],
		[resolve('src/lib')],
	);
	assert.ok(found.ok);
	const result = await load_tasks(found.value);
	assert.ok(result.ok);
	assert.is(result.value.modules.length, 1);
	assert.is(result.value.modules[0].mod, actual_test_task_module);
});

test__load_tasks.run();
/* test__load_tasks */
