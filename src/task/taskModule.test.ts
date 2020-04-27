import {resolve} from 'path';

import {test, t} from '../oki/oki.js';
import {
	validateTaskModule,
	loadTaskModule,
	loadTaskModules,
} from './taskModule.js';
import * as testTask from './fixtures/testTask.task.js';
import * as testFailingTask from './fixtures/testFailingTask.task.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';
import {TASK_FILE_SUFFIX} from './task.js';

test('validateTaskModule()', () => {
	t.ok(validateTaskModule(testTask));
	t.ok(!validateTaskModule(testInvalidTaskModule));
	t.ok(!validateTaskModule({task: {run: {}}}));
});

test('loadTaskModule()', async () => {
	const name = 'task/fixtures/testTask.task.js';
	const id = resolve('src/' + name);
	const result = await loadTaskModule(id);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.name, name);
	t.is(result.mod.mod, testTask);
});

test('loadTaskModules()', async () => {
	test('task names with and without extension', async () => {
		const result = await loadTaskModules(
			[
				resolve('src/task/fixtures/testTask'),
				resolve('src/task/fixtures/testFailingTask.task.ts'),
			],
			[TASK_FILE_SUFFIX],
		);
		t.ok(result.ok);
		t.is(result.modules.length, 2);
		t.is(result.modules[0].mod, testTask);
		t.is(result.modules[1].mod, testFailingTask);
	});

	test('directory', async () => {
		const result = await loadTaskModules([resolve('src/task/fixtures/')]);
		t.ok(result.ok);
		t.is(result.modules.length, 2);
		result.modules.sort((a, b) => (a.id > b.id ? 1 : -1)); // TODO should the API ensure sort order?
		t.is(result.modules[0].mod, testFailingTask);
		t.is(result.modules[1].mod, testTask);
	});

	test('duplicates', async () => {
		const result = await loadTaskModules(
			[
				resolve('src/task/fixtures/testTask'),
				resolve('src/task/fixtures/testTask'),
				resolve('src/task/fixtures/testTask.task.ts'),
				resolve('src/task/fixtures/testFailingTask.task.ts'),
				resolve('src/task/fixtures'),
			],
			[TASK_FILE_SUFFIX],
		);
		t.ok(result.ok);
		t.is(result.modules.length, 2);
	});
});
