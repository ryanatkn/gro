import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {
	TASK_FILE_PATTERN,
	TASK_FILE_SUFFIX,
	is_task_path,
	to_task_path,
	to_task_name,
} from './task.js';

/* test_TASK_FILE_PATTERN */
// TODO this is awkward with the other naming conventions because it's actually 2 things being tested
const test_TASK_FILE_PATTERN = suite('TASK_FILE_PATTERN');

test_TASK_FILE_PATTERN('TASK_FILE_PATTERN and TASK_FILE_SUFFIX are in sync', () => {
	t.ok(TASK_FILE_PATTERN.test('file' + TASK_FILE_SUFFIX));
});

test_TASK_FILE_PATTERN.run();
/* /test_TASK_FILE_PATTERN */

/* test_is_task_path */
const test_is_task_path = suite('is_task_path');

test_is_task_path('basic behavior', () => {
	t.ok(is_task_path('foo.task.ts'));
	t.not.ok(is_task_path('foo.ts'));
	t.not.ok(is_task_path('foo.task.js'));
	t.ok(is_task_path('bar/baz/foo.task.ts'));
	t.not.ok(is_task_path('bar/baz/foo.ts'));
});

test_is_task_path.run();
/* /test_is_task_path */

/* test_to_task_path */
const test_to_task_path = suite('to_task_path');

test_to_task_path('basic behavior', () => {
	t.is(to_task_path('foo'), 'foo.task.ts');
	t.is(to_task_path('bar/baz/foo'), 'bar/baz/foo.task.ts');
});

test_to_task_path('performs no special checks', () => {
	t.is(to_task_path('bar/baz/foo.task.ts'), 'bar/baz/foo.task.ts.task.ts');
});

test_to_task_path.run();
/* /test_to_task_path */

/* test_to_task_name */
const test_to_task_name = suite('to_task_name');

test_to_task_name('basic behavior', () => {
	t.is(to_task_name('foo.task.ts'), 'foo');
	t.is(to_task_name('bar/baz/foo.task.ts'), 'bar/baz/foo');
});

test_to_task_name.run();
/* /test_to_task_name */
