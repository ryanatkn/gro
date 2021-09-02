import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {TASK_FILE_PATTERN, TASK_FILE_SUFFIX, isTaskPath, toTaskPath, toTaskName} from './task.js';

/* test_TASK_FILE_PATTERN */
// TODO this is awkward with the other naming conventions because it's actually 2 things being tested
const test_TASK_FILE_PATTERN = suite('TASK_FILE_PATTERN');

test_TASK_FILE_PATTERN('TASK_FILE_PATTERN and TASK_FILE_SUFFIX are in sync', () => {
	t.ok(TASK_FILE_PATTERN.test('file' + TASK_FILE_SUFFIX));
});

test_TASK_FILE_PATTERN.run();
/* /test_TASK_FILE_PATTERN */

/* testIsTaskPath */
const testIsTaskPath = suite('isTaskPath');

testIsTaskPath('basic behavior', () => {
	t.ok(isTaskPath('foo.task.ts'));
	t.not.ok(isTaskPath('foo.ts'));
	t.not.ok(isTaskPath('foo.task.js'));
	t.ok(isTaskPath('bar/baz/foo.task.ts'));
	t.not.ok(isTaskPath('bar/baz/foo.ts'));
});

testIsTaskPath.run();
/* /testIsTaskPath */

/* testToTaskPath */
const testToTaskPath = suite('toTaskPath');

testToTaskPath('basic behavior', () => {
	t.is(toTaskPath('foo'), 'foo.task.ts');
	t.is(toTaskPath('bar/baz/foo'), 'bar/baz/foo.task.ts');
});

testToTaskPath('performs no special checks', () => {
	t.is(toTaskPath('bar/baz/foo.task.ts'), 'bar/baz/foo.task.ts.task.ts');
});

testToTaskPath.run();
/* /testToTaskPath */

/* testToTaskName */
const testToTaskName = suite('toTaskName');

testToTaskName('basic behavior', () => {
	t.is(toTaskName('foo.task.ts'), 'foo');
	t.is(toTaskName('bar/baz/foo.task.ts'), 'bar/baz/foo');
});

testToTaskName.run();
/* /testToTaskName */
