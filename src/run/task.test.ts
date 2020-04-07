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
import * as testInvalidTaskModule from './fixtures/testInvalidTaskModule.task.js';

test('TASK_FILE_PATTERN and TASK_FILE_SUFFIX are in sync', t => {
	t.ok(TASK_FILE_PATTERN.test('file' + TASK_FILE_SUFFIX));
});

test('isTaskPath()', t => {
	t.ok(isTaskPath('foo.task.js'));
	t.notOk(isTaskPath('foo.js'));
	t.ok(isTaskPath('bar/baz/foo.task.js'));
	t.notOk(isTaskPath('bar/baz/foo.js'));
});

test('toTaskPath()', t => {
	t.is(toTaskPath('foo'), 'foo.task.js');
	t.is(toTaskPath('bar/baz/foo'), 'bar/baz/foo.task.js');
	test('performs no special checks', () => {
		t.is(toTaskPath('bar/baz/foo.task.js'), 'bar/baz/foo.task.js.task.js');
	});
});

test('toTaskName()', t => {
	t.is(toTaskName('foo.task.js'), 'foo');
	t.is(toTaskName('bar/baz/foo.task.js'), 'bar/baz/foo');
});

test('validateTaskModule()', t => {
	t.ok(validateTaskModule(testTask1));
	t.ok(validateTaskModule(testTask2));
	t.notOk(validateTaskModule(testInvalidTaskModule));
	t.notOk(validateTaskModule({task: {run: {}}}));
});
