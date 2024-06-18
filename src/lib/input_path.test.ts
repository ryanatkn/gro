import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {
	to_input_path,
	to_input_paths,
	load_path_ids_by_input_path,
	get_possible_paths,
} from './input_path.js';
import type {Path_Stats} from './path.js';
import {GRO_DIST_DIR, paths} from './paths.js';

test('to_input_path', () => {
	assert.is(to_input_path(resolve('foo.ts')), resolve('foo.ts'));
	assert.is(to_input_path('./foo.ts'), resolve('foo.ts'));
	assert.is(to_input_path('foo.ts'), 'foo.ts');
	assert.is(to_input_path('gro/foo'), GRO_DIST_DIR + 'foo');
	// trailing slashes are preserved:
	assert.is(to_input_path(resolve('foo/bar/')), resolve('foo/bar/'));
	assert.is(to_input_path('./foo/bar/'), resolve('foo/bar/'));
	assert.is(to_input_path('foo/bar/'), 'foo/bar/');
});

test('to_input_paths', () => {
	assert.equal(to_input_paths([resolve('foo/bar.ts'), './baz', 'foo']), [
		resolve('foo/bar.ts'),
		resolve('baz'),
		'foo',
	]);
});

test('get_possible_paths with an implicit relative path', () => {
	const input_path = 'src/foo/bar';
	assert.equal(
		get_possible_paths(
			input_path,
			[resolve('src/foo'), resolve('src/baz'), resolve('src'), resolve('.')],
			['.ext.ts'],
		),
		[
			{id: resolve('src/foo/src/foo/bar'), root_dir: resolve('src/foo')},
			{id: resolve('src/foo/src/foo/bar.ext.ts'), root_dir: resolve('src/foo')},
			{id: resolve('src/baz/src/foo/bar'), root_dir: resolve('src/baz')},
			{id: resolve('src/baz/src/foo/bar.ext.ts'), root_dir: resolve('src/baz')},
			{id: resolve('src/src/foo/bar'), root_dir: resolve('src')},
			{id: resolve('src/src/foo/bar.ext.ts'), root_dir: resolve('src')},
			{id: resolve('src/foo/bar'), root_dir: resolve('.')},
			{id: resolve('src/foo/bar.ext.ts'), root_dir: resolve('.')},
		],
	);
});

test('get_possible_paths in the gro directory', () => {
	const input_path = resolve('src/foo/bar');
	assert.equal(get_possible_paths(input_path, [], ['.ext.ts']), [
		{id: input_path, root_dir: null},
		{id: input_path + '.ext.ts', root_dir: null},
	]);
});

test('get_possible_paths does not repeat the extension', () => {
	const input_path = resolve('src/foo/bar.ext.ts');
	assert.equal(get_possible_paths(input_path, [], ['.ext.ts']), [{id: input_path, root_dir: null}]);
});

test('get_possible_paths does not repeat with the same root directory', () => {
	const input_path = resolve('src/foo/bar.ext.ts');
	assert.equal(get_possible_paths(input_path, [paths.root, paths.root], ['.ext.ts']), [
		{id: input_path, root_dir: null},
	]);
});

test('get_possible_paths implied to be a directory by trailing slash', () => {
	const input_path = resolve('src/foo/bar') + '/';
	assert.equal(get_possible_paths(input_path, [], ['.ext.ts']), [{id: input_path, root_dir: null}]);
});

test('load_path_ids_by_input_path', async () => {
	const test_files: Record<string, Map<string, Path_Stats>> = {
		'fake/test1.ext.ts': new Map([['fake/test1.ext.ts', {isDirectory: () => false}]]),
		'fake/test2.ext.ts': new Map([['fake/test2.ext.ts', {isDirectory: () => false}]]),
		'fake/test3': new Map([
			['fake/test3', {isDirectory: () => true}],
			['a.ts', {isDirectory: () => false}],
			['b.ts', {isDirectory: () => false}],
		]),
		// duplicate
		'fake/': new Map([
			['fake/test3', {isDirectory: () => true}],
			['test3/a.ts', {isDirectory: () => false}],
		]),
		// duplicate and not
		fake: new Map([
			['fake/test3', {isDirectory: () => true}],
			['test3/a.ts', {isDirectory: () => false}],
			['test3/c.ts', {isDirectory: () => false}],
		]),
		'fake/nomatches': new Map([['fake/nomatches', {isDirectory: () => true}]]),
	};
	const result = await load_path_ids_by_input_path(
		new Map([
			['fake/test1.ext.ts', {id: 'fake/test1.ext.ts', is_directory: false}],
			['fake/test2', {id: 'fake/test2.ext.ts', is_directory: false}],
			['fake/test3', {id: 'fake/test3', is_directory: true}],
			['fake/', {id: 'fake/', is_directory: true}],
			['fake', {id: 'fake', is_directory: true}],
			['fake/nomatches', {id: 'fake/nomatches', is_directory: true}],
		]),
		async (id) => test_files[id],
	);
	assert.equal(result, {
		path_ids_by_input_path: new Map([
			['fake/test1.ext.ts', ['fake/test1.ext.ts']],
			['fake/test2', ['fake/test2.ext.ts']],
			['fake/test3', ['fake/test3/a.ts', 'fake/test3/b.ts']],
			['fake', ['fake/test3/c.ts']],
		]),
		input_directories_with_no_files: ['fake/nomatches'],
	});
});

test.run();
