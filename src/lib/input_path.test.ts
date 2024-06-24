import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {
	to_input_path,
	to_input_paths,
	resolve_input_files,
	get_possible_paths,
	type Resolved_Input_Path,
	type Resolved_Input_File,
} from './input_path.js';
import {GRO_DIST_DIR, paths} from './paths.js';
import type {Resolved_Path} from './path.js';

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
			{
				id: resolve('src/foo/src/foo/bar'),
				input_path: 'src/foo/bar',
				root_dir: resolve('src/foo'),
			},
			{
				id: resolve('src/foo/src/foo/bar.ext.ts'),
				input_path: 'src/foo/bar',
				root_dir: resolve('src/foo'),
			},
			{
				id: resolve('src/baz/src/foo/bar'),
				input_path: 'src/foo/bar',
				root_dir: resolve('src/baz'),
			},
			{
				id: resolve('src/baz/src/foo/bar.ext.ts'),
				input_path: 'src/foo/bar',
				root_dir: resolve('src/baz'),
			},
			{
				id: resolve('src/src/foo/bar'),
				input_path: 'src/foo/bar',
				root_dir: resolve('src'),
			},
			{
				id: resolve('src/src/foo/bar.ext.ts'),
				input_path: 'src/foo/bar',
				root_dir: resolve('src'),
			},
			{
				id: resolve('src/foo/bar'),
				input_path: 'src/foo/bar',
				root_dir: resolve('.'),
			},
			{
				id: resolve('src/foo/bar.ext.ts'),
				input_path: 'src/foo/bar',
				root_dir: resolve('.'),
			},
		],
	);
});

test('get_possible_paths in the gro directory', () => {
	const input_path = resolve('src/foo/bar');
	assert.equal(get_possible_paths(input_path, [], ['.ext.ts']), [
		{id: input_path, input_path: resolve('src/foo/bar'), root_dir: resolve('src/foo')},
		{id: input_path + '.ext.ts', input_path: resolve('src/foo/bar'), root_dir: resolve('src/foo')},
	]);
});

test('get_possible_paths does not repeat the extension', () => {
	const input_path = resolve('src/foo/bar.ext.ts');
	assert.equal(get_possible_paths(input_path, [], ['.ext.ts']), [
		{id: input_path, input_path: resolve('src/foo/bar.ext.ts'), root_dir: resolve('src/foo')},
	]);
});

test('get_possible_paths does not repeat with the same root directory', () => {
	const input_path = resolve('src/foo/bar.ext.ts');
	assert.equal(get_possible_paths(input_path, [paths.root, paths.root], ['.ext.ts']), [
		{id: input_path, input_path: resolve('src/foo/bar.ext.ts'), root_dir: resolve('src/foo')},
	]);
});

test('get_possible_paths implied to be a directory by trailing slash', () => {
	const input_path = resolve('src/foo/bar') + '/';
	assert.equal(get_possible_paths(input_path, [], ['.ext.ts']), [
		{id: input_path, input_path: resolve('src/foo/bar') + '/', root_dir: resolve('src/foo')},
	]);
});

test('resolve_input_files', async () => {
	const test_files: Record<string, Resolved_Path[]> = {
		'fake/test1.ext.ts': [{id: '', path: 'fake/test1.ext.ts', is_directory: false}],
		'fake/test2.ext.ts': [{id: '', path: 'fake/test2.ext.ts', is_directory: false}],
		'fake/test3': [
			{id: '', path: 'fake/test3', is_directory: true},
			{id: '', path: 'a.ts', is_directory: false},
			{id: '', path: 'b.ts', is_directory: false},
		],
		// duplicate
		'fake/': [
			{id: '', path: 'fake/test3', is_directory: true},
			{id: '', path: 'test3/a.ts', is_directory: false},
		],
		// duplicate and not
		fake: [
			{id: '', path: 'fake/test3', is_directory: true},
			{id: '', path: 'test3/a.ts', is_directory: false},
			{id: '', path: 'test3/c.ts', is_directory: false},
		],
		'fake/nomatches': [{id: '', path: 'fake/nomatches', is_directory: true}],
	};
	const a: Resolved_Input_Path = {
		id: 'fake/test1.ext.ts',
		is_directory: false,
		input_path: 'fake/test1.ext.ts',
		root_dir: process.cwd(),
	};
	const b: Resolved_Input_Path = {
		id: 'fake/test2.ext.ts',
		is_directory: false,
		input_path: 'fake/test2',
		root_dir: process.cwd(),
	};
	const c: Resolved_Input_Path = {
		id: 'fake/test3',
		is_directory: true,
		input_path: 'fake/test3',
		root_dir: process.cwd(),
	};
	const d: Resolved_Input_Path = {
		id: 'fake',
		is_directory: true,
		input_path: 'fake',
		root_dir: process.cwd(),
	};
	const e: Resolved_Input_Path = {
		id: 'fake/nomatches',
		is_directory: true,
		input_path: 'fake/nomatches',
		root_dir: process.cwd(),
	};
	const result = resolve_input_files([a, b, c, d, e], (id) => test_files[id]);
	const resolved_input_files: Resolved_Input_File[] = [
		{id: a.id, input_path: a.input_path, resolved_input_path: a},
		{id: b.id, input_path: b.input_path, resolved_input_path: b},
		{id: 'fake/test3/a.ts', input_path: c.input_path, resolved_input_path: c},
		{id: 'fake/test3/b.ts', input_path: c.input_path, resolved_input_path: c},
		{id: 'fake/test3/c.ts', input_path: d.input_path, resolved_input_path: d},
	];
	assert.equal(result, {
		resolved_input_files,
		resolved_input_files_by_root_dir: new Map([
			[
				process.cwd(),
				[
					{id: 'fake/test1.ext.ts', input_path: 'fake/test1.ext.ts', resolved_input_path: a},
					{id: 'fake/test2.ext.ts', input_path: 'fake/test2', resolved_input_path: b},
					{id: 'fake/test3/a.ts', input_path: 'fake/test3', resolved_input_path: c},
					{id: 'fake/test3/b.ts', input_path: 'fake/test3', resolved_input_path: c},
					{id: 'fake/test3/c.ts', input_path: 'fake', resolved_input_path: d},
				],
			],
		]),
		input_directories_with_no_files: [e.input_path],
	});
});

test.run();
