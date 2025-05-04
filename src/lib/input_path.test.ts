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
} from './input_path.ts';
import {GRO_DIST_DIR, paths} from './paths.ts';
import type {Resolved_Path} from './path.ts';

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

test('resolve_input_files', () => {
	const test_files: Record<string, Array<Resolved_Path>> = {
		'fake/test1.ext.ts': [
			{id: 'fake/test1.ext.ts', path: 'fake/test1.ext.ts', is_directory: false},
		],
		'fake/test2.ext.ts': [
			{id: 'fake/test2.ext.ts', path: 'fake/test2.ext.ts', is_directory: false},
		],
		'fake/test3': [
			{id: 'fake/test3', path: 'fake/test3', is_directory: true},
			{id: 'a.ts', path: 'a.ts', is_directory: false},
			{id: 'b.ts', path: 'b.ts', is_directory: false},
		],
		// duplicate
		'fake/': [
			{id: 'fake/test3', path: 'fake/test3', is_directory: true},
			{id: 'test3/a.ts', path: 'test3/a.ts', is_directory: false},
		],
		// duplicate and not
		fake: [
			{id: 'fake/test3', path: 'fake/test3', is_directory: true},
			{id: 'test3/a.ts', path: 'test3/a.ts', is_directory: false},
			{id: 'test3/c.ts', path: 'test3/c.ts', is_directory: false},
		],
		'fake/nomatches': [{id: 'fake/nomatches', path: 'fake/nomatches', is_directory: true}],
		fake2: [{id: 'test.ext.ts', path: 'test.ext.ts', is_directory: false}],
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
	// These two have the same id from different directory input paths.
	const f: Resolved_Input_Path = {
		id: 'fake2',
		is_directory: true,
		input_path: 'fake2',
		root_dir: process.cwd(),
	};
	const g: Resolved_Input_Path = {
		id: 'fake2',
		is_directory: true,
		input_path: './fake2/',
		root_dir: process.cwd(),
	};
	// These two have the same id from different file input paths.
	const h: Resolved_Input_Path = {
		id: 'fake3/test.ext.ts',
		is_directory: false,
		input_path: 'fake3/test.ext.ts',
		root_dir: process.cwd(),
	};
	const i: Resolved_Input_Path = {
		id: 'fake3/test.ext.ts',
		is_directory: false,
		input_path: 'fake3/test',
		root_dir: process.cwd(),
	};
	const result = resolve_input_files([a, b, c, d, e, f, g, h, i], (dir) => test_files[dir]);
	const resolved_input_files: Array<Resolved_Input_File> = [
		{id: a.id, input_path: a.input_path, resolved_input_path: a},
		{id: b.id, input_path: b.input_path, resolved_input_path: b},
		{id: 'fake/test3/a.ts', input_path: c.input_path, resolved_input_path: c},
		{id: 'fake/test3/b.ts', input_path: c.input_path, resolved_input_path: c},
		{id: 'fake/test3/c.ts', input_path: d.input_path, resolved_input_path: d},
		{id: 'fake2/test.ext.ts', input_path: f.input_path, resolved_input_path: f},
		{id: 'fake3/test.ext.ts', input_path: h.input_path, resolved_input_path: h},
	];
	assert.equal(result, {
		resolved_input_files,
		resolved_input_files_by_root_dir: new Map([
			[
				process.cwd(),
				[
					{id: 'fake/test1.ext.ts', input_path: a.input_path, resolved_input_path: a},
					{id: 'fake/test2.ext.ts', input_path: b.input_path, resolved_input_path: b},
					{id: 'fake/test3/a.ts', input_path: c.input_path, resolved_input_path: c},
					{id: 'fake/test3/b.ts', input_path: c.input_path, resolved_input_path: c},
					{id: 'fake/test3/c.ts', input_path: d.input_path, resolved_input_path: d},
					{id: 'fake2/test.ext.ts', input_path: f.input_path, resolved_input_path: f},
					{id: 'fake3/test.ext.ts', input_path: h.input_path, resolved_input_path: h},
				],
			],
		]),
		input_directories_with_no_files: [e.input_path],
	});
});

test.run();
