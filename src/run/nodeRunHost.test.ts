import {resolve} from 'path';

import {test, t} from '../oki/oki.js';
import {createNodeRunHost} from './nodeRunHost.js';
import {validateTaskModule} from './task.js';

test('createNodeRunHost()', () => {
	const host = createNodeRunHost();

	test('host.findTaskModules()', async () => {
		const taskSourceIds = await host.findTaskModules(
			resolve('src/run/fixtures'),
		);
		t.equal(taskSourceIds, [
			resolve('src/run/fixtures/testFailingTask.task.ts'),
			resolve('src/run/fixtures/testTask.task.ts'),
		]);
	});

	test('host.loadTaskModule()', async () => {
		const task = await host.loadTaskModule(
			resolve('src/run/fixtures/testTask.task.ts'),
		);
		t.is(task.id, resolve('src/run/fixtures/testTask.task.ts'));
		t.is(task.name, 'run/fixtures/testTask');
		t.ok(validateTaskModule(task.mod));
	});
});
