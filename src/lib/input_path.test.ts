import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {
	to_input_path,
	to_input_paths,
	load_source_ids_by_input_path,
	get_possible_source_ids,
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

test('get_possible_source_ids in the gro directory', () => {
	const input_path = resolve('src/foo/bar');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts']), [
		input_path,
		input_path + '.baz.ts',
	]);
});

test('get_possible_source_ids does not repeat the extension', () => {
	const input_path = resolve('src/foo/bar.baz.ts');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts']), [input_path]);
});

test('get_possible_source_ids does not repeat with the same root directory', () => {
	const input_path = resolve('src/foo/bar.baz.ts');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts'], [paths.root, paths.root]), [
		input_path,
	]);
});

test('get_possible_source_ids implied to be a directory by trailing slash', () => {
	const input_path = resolve('src/foo/bar') + '/';
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts']), [input_path]);
});

test('load_source_ids_by_input_path', async () => {
	const test_files: Record<string, Map<string, Path_Stats>> = {
		'fake/test1.bar.ts': new Map([['fake/test1.bar.ts', {isDirectory: () => false}]]),
		'fake/test2.bar.ts': new Map([['fake/test2.bar.ts', {isDirectory: () => false}]]),
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
	const result = await load_source_ids_by_input_path(
		new Map([
			['fake/test1.bar.ts', {id: 'fake/test1.bar.ts', isDirectory: false}],
			['fake/test2', {id: 'fake/test2.bar.ts', isDirectory: false}],
			['fake/test3', {id: 'fake/test3', isDirectory: true}],
			['fake/', {id: 'fake/', isDirectory: true}],
			['fake', {id: 'fake', isDirectory: true}],
			['fake/nomatches', {id: 'fake/nomatches', isDirectory: true}],
		]),
		async (id) => test_files[id],
	);
	assert.equal(result, {
		source_ids_by_input_path: new Map([
			['fake/test1.bar.ts', ['fake/test1.bar.ts']],
			['fake/test2', ['fake/test2.bar.ts']],
			['fake/test3', ['fake/test3/a.ts', 'fake/test3/b.ts']],
			['fake', ['fake/test3/c.ts']],
		]),
		input_directories_with_no_files: ['fake/nomatches'],
	});
});

test.run();
