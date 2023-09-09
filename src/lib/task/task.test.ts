import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {is_task_path, to_task_name} from './task.js';

/* test__is_task_path */
const test__is_task_path = suite('is_task_path');

test__is_task_path('basic behavior', () => {
	assert.ok(is_task_path('foo.task.ts'));
	assert.ok(is_task_path('foo.task.js'));
	assert.ok(!is_task_path('foo.ts'));
	assert.ok(is_task_path('bar/baz/foo.task.ts'));
	assert.ok(!is_task_path('bar/baz/foo.ts'));
});

test__is_task_path.run();
/* test__is_task_path */

/* test__to_task_name */
const test__to_task_name = suite('to_task_name');

test__to_task_name('basic behavior', () => {
	assert.is(to_task_name('foo.task.ts'), 'foo');
	assert.is(to_task_name('bar/baz/foo.task.ts'), 'bar/baz/foo');
});

test__to_task_name.run();
/* test__to_task_name */
