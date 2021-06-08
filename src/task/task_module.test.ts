import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve} from 'path';

import {validateTaskModule, load_task_module, load_task_modules} from './task_module.js';
import * as actualTestTaskModule from '../test.task.js';
import * as testTaskModule from './fixtures/testTaskModule.taskFixture.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';
import {fs} from '../fs/node.js';

/* test_validateTaskModule */
const test_validateTaskModule = suite('validateTaskModule');

test_validateTaskModule('basic behavior', () => {
	t.ok(validateTaskModule(testTaskModule));
	t.not.ok(validateTaskModule(testInvalidTaskModule));
	t.not.ok(validateTaskModule({task: {run: {}}}));
});

test_validateTaskModule.run();
/* /test_validateTaskModule */

/* test_load_task_module */
const test_load_task_module = suite('load_task_module');

test_load_task_module('basic behavior', async () => {
	const name = 'task/fixtures/testTaskModule.taskFixture.js';
	const id = resolve('src/' + name);
	const result = await load_task_module(id);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.id, id);
	t.is(result.mod.name, name);
	t.is(result.mod.mod, testTaskModule);
});

test_load_task_module('invalid module', async () => {
	const id = resolve('src/task/fixtures/testInvalidTaskModule.js');
	const result = await load_task_module(id);
	t.not.ok(result.ok);
	if (result.type === 'invalid') {
		t.is(result.id, id);
		t.is(result.mod, testInvalidTaskModule);
		t.is(result.validation, 'validateTaskModule');
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
	t.is(result.modules[0].mod, actualTestTaskModule);
});

test_load_task_modules.run();
/* /test_load_task_modules */
