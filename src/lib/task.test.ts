import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {is_task_path, to_task_name} from './task.js';

test('is_task_path basic behavior', () => {
	assert.ok(is_task_path('foo.task.ts'));
	assert.ok(is_task_path('foo.task.js'));
	assert.ok(!is_task_path('foo.ts'));
	assert.ok(is_task_path('bar/baz/foo.task.ts'));
	assert.ok(!is_task_path('bar/baz/foo.ts'));
});

test('to_task_name basic behavior', () => {
	assert.is(to_task_name('foo.task.ts', []), 'foo');
	assert.is(to_task_name('bar/baz/foo.task.ts', []), 'bar/baz/foo');
	assert.is(to_task_name('a/b/c/foo.task.ts', ['a/b/c', 'a']), 'foo');
	assert.is(to_task_name('a/b/c/foo.task.ts', ['a']), 'b/c/foo');
	assert.is(to_task_name('a/b/c/foo.task.ts', ['a/b', 'a']), 'c/foo');
});

test.run();
