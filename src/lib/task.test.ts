import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {is_task_path, to_task_name, validate_task_module, find_tasks, load_tasks} from './task.ts';
import * as actual_test_task_module from './test.task.ts';
import {create_empty_gro_config} from './gro_config.ts';
import {GRO_DIST_DIR} from './paths.ts';

test('is_task_path basic behavior', () => {
	assert.ok(is_task_path('foo.task.ts'));
	assert.ok(is_task_path('foo.task.js'));
	assert.ok(!is_task_path('foo.ts'));
	assert.ok(is_task_path('bar/baz/foo.task.ts'));
	assert.ok(!is_task_path('bar/baz/foo.ts'));
});

test('to_task_name basic behavior', () => {
	assert.is(to_task_name('foo.task.ts', process.cwd(), '', ''), 'foo');
	assert.is(to_task_name('bar/baz/foo.task.ts', process.cwd(), '', ''), 'bar/baz/foo');
	assert.is(to_task_name('a/b/c/foo.task.ts', 'a/b/c', '', ''), 'foo');
	assert.is(to_task_name('a/b/c/foo.task.ts', 'a', '', ''), 'b/c/foo');
	assert.is(to_task_name('a/b/c/foo.task.ts', 'a/b', '', ''), 'c/foo');
	assert.is(to_task_name('/a/b/c/foo.task.ts', '/a/b', '/a/b', '/a/b/d'), '../c/foo');
	assert.is(to_task_name('/a/b/c/foo.task.ts', '/a/b', '/a/b', '/a/b'), 'c/foo');
	assert.is(to_task_name('/a/b/c/foo.task.ts', '/a/b', '/a/b', '/a/b/c'), 'foo');
	assert.is(to_task_name('/a/b/d/foo.task.js', '/a/b/d', '/a/b/d/foo', '/a/c'), '../b/d/foo');
	assert.is(
		to_task_name(
			GRO_DIST_DIR + 'foo.task.js',
			GRO_DIST_DIR.slice(0, -1),
			GRO_DIST_DIR + 'foo',
			'/a',
		),
		'foo',
	);
	assert.is(
		to_task_name(
			GRO_DIST_DIR + 'foo.task.js',
			GRO_DIST_DIR, // same as above but adds a trailing slash here
			GRO_DIST_DIR + 'foo',
			'/a',
		),
		'foo',
	);
	assert.is(
		to_task_name(resolve('a/b'), resolve('b'), '', ''),
		resolve('a/b'),
		'falls back to the id when unresolved',
	);
});

// TODO if we import directly, svelte-package generates types in `src/fixtures`
const test_task_module = await import('../fixtures/' + 'test_task_module.task_fixture'); // eslint-disable-line no-useless-concat
const test_invalid_task_module = await import('../fixtures/' + 'test_invalid_task_module.js'); // eslint-disable-line no-useless-concat

test('validate_task_module basic behavior', () => {
	assert.ok(validate_task_module(test_task_module));
	assert.ok(!validate_task_module(test_invalid_task_module));
	assert.ok(!validate_task_module({task: {run: {}}}));
});

test('load_tasks basic behavior', async () => {
	const found = find_tasks(
		[resolve('src/lib/test'), resolve('src/lib/test.task.ts')],
		[resolve('src/lib')],
		create_empty_gro_config(),
	);
	assert.ok(found.ok);
	const result = await load_tasks(found.value);
	assert.ok(result.ok);
	assert.is(result.value.modules.length, 1);
	assert.is(result.value.modules[0].mod, actual_test_task_module);
});

test.run();
