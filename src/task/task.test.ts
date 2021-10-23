import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {TASK_FILE_PATTERN, TASK_FILE_SUFFIX, isTaskPath, toTaskPath, toTaskName} from './task.js';

/* test__TASK_FILE_PATTERN */
// TODO this is awkward with the other naming conventions because it's actually 2 things being tested
const test__TASK_FILE_PATTERN = suite('TASK_FILE_PATTERN');

test__TASK_FILE_PATTERN('TASK_FILE_PATTERN and TASK_FILE_SUFFIX are in sync', () => {
	assert.ok(TASK_FILE_PATTERN.test('file' + TASK_FILE_SUFFIX));
});

test__TASK_FILE_PATTERN.run();
/* test__TASK_FILE_PATTERN */

/* test__isTaskPath */
const test__isTaskPath = suite('isTaskPath');

test__isTaskPath('basic behavior', () => {
	assert.ok(isTaskPath('foo.task.ts'));
	assert.not.ok(isTaskPath('foo.ts'));
	assert.not.ok(isTaskPath('foo.task.js'));
	assert.ok(isTaskPath('bar/baz/foo.task.ts'));
	assert.not.ok(isTaskPath('bar/baz/foo.ts'));
});

test__isTaskPath.run();
/* test__isTaskPath */

/* test__toTaskPath */
const test__toTaskPath = suite('toTaskPath');

test__toTaskPath('basic behavior', () => {
	assert.is(toTaskPath('foo'), 'foo.task.ts');
	assert.is(toTaskPath('bar/baz/foo'), 'bar/baz/foo.task.ts');
});

test__toTaskPath('performs no special checks', () => {
	assert.is(toTaskPath('bar/baz/foo.task.ts'), 'bar/baz/foo.task.ts.task.ts');
});

test__toTaskPath.run();
/* test__toTaskPath */

/* test__toTaskName */
const test__toTaskName = suite('toTaskName');

test__toTaskName('basic behavior', () => {
	assert.is(toTaskName('foo.task.ts'), 'foo');
	assert.is(toTaskName('bar/baz/foo.task.ts'), 'bar/baz/foo');
});

test__toTaskName.run();
/* test__toTaskName */
