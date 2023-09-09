import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';
// TODO BLOCK do this with the test runner generically, maybe lazy loaded in the loader if we see typescript
import 'source-map-support/register.js';

import {
	resolve_raw_input_path,
	resolve_raw_input_paths,
	load_source_ids_by_input_path,
	get_possible_source_ids,
} from './input_path.js';
import type {PathStats} from './path_data.js';
import {gro_paths, replace_root_dir, create_paths, paths} from './paths.js';

/* test__resolve_raw_input_path */
const test__resolve_raw_input_path = suite('resolve_raw_input_path');

test__resolve_raw_input_path('basic behavior', () => {
	const target = resolve('src/lib/foo/bar.ts');
	assert.is(resolve_raw_input_path('foo/bar.ts'), target);
	assert.is(resolve_raw_input_path('src/lib/foo/bar.ts'), target);
	assert.is(resolve_raw_input_path('./src/lib/foo/bar.ts'), target);
	assert.is(resolve_raw_input_path('./foo/bar.ts'), target); // questionable
	assert.is(resolve_raw_input_path(target), target);
	assert.is.not(resolve_raw_input_path('bar.ts'), target);
});

test__resolve_raw_input_path('source directory', () => {
	const target_dir = resolve('src/lib') + '/'; // inferred as directory
	assert.is(resolve_raw_input_path('src/lib'), target_dir);
	assert.is(resolve_raw_input_path('src/lib/'), target_dir);
	assert.is(resolve_raw_input_path('./src/lib'), target_dir);
	assert.is(resolve_raw_input_path('./src/lib/'), target_dir);
	assert.is(resolve_raw_input_path('./srcTest'), target_dir + 'srcTest');
	assert.is(resolve_raw_input_path('srcTest'), target_dir + 'srcTest');
	assert.is.not(resolve_raw_input_path('.gro'), target_dir);
});

test__resolve_raw_input_path('directories', () => {
	const target_dir = resolve('src/lib/foo/bar');
	assert.is(resolve_raw_input_path('foo/bar'), target_dir);
	assert.is(resolve_raw_input_path('foo/bar/'), target_dir);
	assert.is(resolve_raw_input_path('src/lib/foo/bar'), target_dir);
	assert.is(resolve_raw_input_path('src/lib/foo/bar/'), target_dir);
	assert.is(resolve_raw_input_path('./src/lib/foo/bar'), target_dir);
	assert.is(resolve_raw_input_path('./src/lib/foo/bar/'), target_dir);
	assert.is.not(resolve_raw_input_path('bar'), target_dir);
});

test__resolve_raw_input_path.run();
/* test__resolve_raw_input_path */

/* test__resolve_raw_input_paths */
const test__resolve_raw_input_paths = suite('resolve_raw_input_paths');

test__resolve_raw_input_paths('resolves multiple input path forms', () => {
	assert.equal(resolve_raw_input_paths(['foo/bar.ts', 'baz', './']), [
		resolve('src/lib/foo/bar.ts'),
		resolve('src/lib/baz'),
		resolve('src/lib') + '/',
	]);
});

test__resolve_raw_input_paths('default to src/lib', () => {
	assert.equal(resolve_raw_input_paths([]), [resolve('src/lib') + '/']);
});

test__resolve_raw_input_paths.run();
/* test__resolve_raw_input_paths */

/* test__get_possible_source_ids */
const test__get_possible_source_ids = suite('get_possible_source_ids');

test__get_possible_source_ids('in the gro directory', () => {
	const input_path = resolve('src/foo/bar');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts']), [
		input_path,
		input_path + '.baz.ts',
		input_path + '/bar.baz.ts',
	]);
});

test__get_possible_source_ids('does not repeat the extension', () => {
	const input_path = resolve('src/foo/bar.baz.ts');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts']), [input_path]);
});

test__get_possible_source_ids('does not repeat with the same root directory', () => {
	const input_path = resolve('src/foo/bar.baz.ts');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts'], [paths.root, paths.root]), [
		input_path,
	]);
});

test__get_possible_source_ids('implied to be a directory by trailing slash', () => {
	const input_path = resolve('src/foo/bar') + '/';
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts']), [input_path]);
});

test__get_possible_source_ids('in both another directory and gro', () => {
	const fake_dir = resolve('../fake') + '/';
	const fake_paths = create_paths(fake_dir);
	const input_path = join(fake_dir, 'src/foo/bar');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts'], [gro_paths.root], fake_paths), [
		input_path,
		input_path + '.baz.ts',
		input_path + '/bar.baz.ts',
		replace_root_dir(input_path, gro_paths.root, fake_paths),
		replace_root_dir(input_path, gro_paths.root, fake_paths) + '.baz.ts',
		replace_root_dir(input_path, gro_paths.root, fake_paths) + '/bar.baz.ts',
	]);
});

test__get_possible_source_ids.run();
/* test__get_possible_source_ids */

/* test__load_source_ids_by_input_path */
const test__load_source_ids_by_input_path = suite('load_source_ids_by_input_path', async () => {
	const test_files: Record<string, Map<string, PathStats>> = {
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

test__load_source_ids_by_input_path.run();
/* test__load_source_ids_by_input_path */
