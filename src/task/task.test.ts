import {test, t} from '../oki/oki.js';
import {
	TASK_FILE_PATTERN,
	TASK_FILE_SUFFIX,
	isTaskPath,
	toTaskPath,
	toTaskName,
} from './task.js';

test('TASK_FILE_PATTERN and TASK_FILE_SUFFIX are in sync', () => {
	t.ok(TASK_FILE_PATTERN.test('file' + TASK_FILE_SUFFIX));
});

test('isTaskPath()', () => {
	t.ok(isTaskPath('foo.task.ts'));
	t.ok(!isTaskPath('foo.ts'));
	t.ok(!isTaskPath('foo.task.js'));
	t.ok(isTaskPath('bar/baz/foo.task.ts'));
	t.ok(!isTaskPath('bar/baz/foo.ts'));
});

test('toTaskPath()', () => {
	t.is(toTaskPath('foo'), 'foo.task.ts');
	t.is(toTaskPath('bar/baz/foo'), 'bar/baz/foo.task.ts');
	test('performs no special checks', () => {
		t.is(toTaskPath('bar/baz/foo.task.ts'), 'bar/baz/foo.task.ts.task.ts');
	});
});

test('toTaskName()', () => {
	t.is(toTaskName('foo.task.ts'), 'foo');
	t.is(toTaskName('bar/baz/foo.task.ts'), 'bar/baz/foo');
});
