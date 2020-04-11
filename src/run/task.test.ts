import {test} from '../oki/index.js';
import {
	TASK_FILE_PATTERN,
	TASK_FILE_SUFFIX,
	isTaskPath,
	toTaskPath,
	toTaskName,
	validateTaskModule,
} from './task.js';
import * as testTask1 from './fixtures/testTask1.task.js';
import * as testTask2 from './fixtures/testTask2.task.js';
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.js';

test('TASK_FILE_PATTERN and TASK_FILE_SUFFIX are in sync', t => {
	t.ok(TASK_FILE_PATTERN.test('file' + TASK_FILE_SUFFIX));
});

test('isTaskPath()', t => {
	t.ok(isTaskPath('foo.task.ts'));
	t.notOk(isTaskPath('foo.ts'));
	t.notOk(isTaskPath('foo.task.js'));
	t.ok(isTaskPath('bar/baz/foo.task.ts'));
	t.notOk(isTaskPath('bar/baz/foo.ts'));
});

test('toTaskPath()', t => {
	t.is(toTaskPath('foo'), 'foo.task.ts');
	t.is(toTaskPath('bar/baz/foo'), 'bar/baz/foo.task.ts');
	test('performs no special checks', () => {
		t.is(toTaskPath('bar/baz/foo.task.ts'), 'bar/baz/foo.task.ts.task.ts');
	});
});

test('toTaskName()', t => {
	t.is(toTaskName('foo.task.ts'), 'foo');
	t.is(toTaskName('bar/baz/foo.task.ts'), 'bar/baz/foo');
});

test('validateTaskModule()', t => {
	t.ok(validateTaskModule(testTask1));
	t.ok(validateTaskModule(testTask2));
	t.notOk(validateTaskModule(testInvalidTaskModule));
	t.notOk(validateTaskModule({task: {run: {}}}));
});
