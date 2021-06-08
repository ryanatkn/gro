import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve} from 'path';

import {validate_task_module, load_task_module, load_task_modules} from './task_module.js';
import * as actual_test_task_module from '../test.task.js';
import * as test_task_module from './fixtures/test_task_module.task_fixture.js';
import * as test_invalid_task_module from './fixtures/test_invalid_task_module.js';
import {fs} from '../fs/node.js';

/* test_validate_task_module */
const test_validate_task_module = suite('validate_task_module');

test_validate_task_module('basic behavior', () => {
	t.ok(validate_task_module(test_task_module));
	t.not.ok(validate_task_module(test_invalid_task_module));
	t.not.ok(validate_task_module({task: {run: {}}}));
});

test_validate_task_module.run();
/* /test_validate_task_module */

/* test_load_task_module */
const test_load_task_module = suite('load_task_module');

test_load_task_module('basic behavior', async () => {
	const name = 'task/fixtures/test_task_module.task_fixture.js';
	const id = resolve('src/' + name);
	const result = await load_task_module(id);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.id, id);
	t.is(result.mod.name, name);
	t.is(result.mod.mod, test_task_module);
});

test_load_task_module('invalid module', async () => {
	const id = resolve('src/task/fixtures/test_invalid_task_module.js');
	const result = await load_task_module(id);
	t.not.ok(result.ok);
	if (result.type === 'invalid') {
		t.is(result.id, id);
		t.is(result.mod, test_invalid_task_module);
		t.is(result.validation, 'validate_task_module');
	} else {
		throw Error('should be invalid');
	}
});

test_load_task_module('failing module', async () => {
	const id = resolve('src/task/fixtures/testFailingTaskModule.js');
	const result = await load_task_module(id);
	t.not.ok(result.ok);
	if (result.type === 'import_failed') {
		t.is(result.id, id);
		t.ok(result.error);
	} else {
		throw Error('should have failed');
	}
});

test_load_task_module.run();
/* /test_load_task_module */

/* test_load_task_modules */
const test_load_task_modules = suite('load_task_modules');

test_load_task_modules('basic behavior', async () => {
	const result = await load_task_modules(fs, [resolve('src/test'), resolve('src/test.task.ts')]);
	t.ok(result.ok);
	t.is(result.modules.length, 1);
	t.is(result.modules[0].mod, actual_test_task_module);
});

test_load_task_modules.run();
/* /test_load_task_modules */
