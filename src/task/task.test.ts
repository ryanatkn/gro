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

/* test_isTaskPath */
const test_isTaskPath = suite('isTaskPath');

test_isTaskPath('basic behavior', () => {
	t.ok(isTaskPath('foo.task.ts'));
	t.ok(!isTaskPath('foo.ts'));
	t.ok(!isTaskPath('foo.task.js'));
	t.ok(isTaskPath('bar/baz/foo.task.ts'));
	t.ok(!isTaskPath('bar/baz/foo.ts'));
});

test_isTaskPath.run();
/* /test_isTaskPath */

/* test_toTaskPath */
const test_toTaskPath = suite('toTaskPath');

test_toTaskPath('basic behavior', () => {
	t.is(toTaskPath('foo'), 'foo.task.ts');
	t.is(toTaskPath('bar/baz/foo'), 'bar/baz/foo.task.ts');
});

test_toTaskPath('performs no special checks', () => {
	t.is(toTaskPath('bar/baz/foo.task.ts'), 'bar/baz/foo.task.ts.task.ts');
});

test_toTaskPath.run();
/* /test_toTaskPath */

/* test_toTaskName */
const test_toTaskName = suite('toTaskName');

test_toTaskName('basic behavior', () => {
	t.is(toTaskName('foo.task.ts'), 'foo');
	t.is(toTaskName('bar/baz/foo.task.ts'), 'bar/baz/foo');
});

test_toTaskName.run();
/* /test_toTaskName */
