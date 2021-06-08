import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, sep, join} from 'path';

import {
	resolve_raw_input_path,
	resolve_raw_input_paths,
	load_source_path_data_by_input_path,
	load_source_ids_by_input_path,
	get_possible_source_ids,
} from './input_path.js';
import type {Path_Stats} from './path_data.js';
import {gro_paths, replace_root_dir, create_paths, paths} from '../paths.js';
import {fs} from './node.js';

/* test_resolve_raw_input_path */
const test_resolve_raw_input_path = suite('resolve_raw_input_path');

test_resolve_raw_input_path('basic behavior', () => {
	const target = resolve('src/foo/bar.ts');
	t.is(resolve_raw_input_path('foo/bar.ts'), target);
	t.is(resolve_raw_input_path('src/foo/bar.ts'), target);
	t.is(resolve_raw_input_path('./src/foo/bar.ts'), target);
	t.is(resolve_raw_input_path('./foo/bar.ts'), target); // questionable
	t.is(resolve_raw_input_path(target), target);
	t.is.not(resolve_raw_input_path('bar.ts'), target);
});

test_resolve_raw_input_path('source directory', () => {
	const targetDir = resolve('src') + '/'; // inferred as directory
	t.is(resolve_raw_input_path('src'), targetDir);
	t.is(resolve_raw_input_path('src/'), targetDir);
	t.is(resolve_raw_input_path('./src'), targetDir);
	t.is(resolve_raw_input_path('./src/'), targetDir);
	t.is(resolve_raw_input_path('./srcTest'), targetDir + 'srcTest');
	t.is(resolve_raw_input_path('srcTest'), targetDir + 'srcTest');
	t.is.not(resolve_raw_input_path('.gro'), targetDir);
});

test_resolve_raw_input_path('forced gro directory', () => {
	const fakeDir = resolve('../fake') + sep;
	const fakePaths = create_paths(fakeDir);
	const groTarget = resolve('src/foo/bar.ts');
	t.is(resolve_raw_input_path('gro/foo/bar.ts'), groTarget);
	t.is(resolve_raw_input_path('foo/bar.ts', fakePaths), join(fakeDir, 'src/foo/bar.ts'));
	t.is(resolve_raw_input_path('gro/foo/bar.ts', fakePaths), join(fakeDir, 'src/gro/foo/bar.ts'));
	t.is(resolve_raw_input_path('foo/bar.ts'), groTarget);
	t.is(resolve_raw_input_path('foo/bar.ts', gro_paths), groTarget);
	t.is(resolve_raw_input_path('gro'), resolve('src') + sep);
});

test_resolve_raw_input_path('directories', () => {
	const targetDir = resolve('src/foo/bar');
	t.is(resolve_raw_input_path('foo/bar'), targetDir);
	t.is(resolve_raw_input_path('foo/bar/'), targetDir + '/');
	t.is(resolve_raw_input_path('src/foo/bar'), targetDir);
	t.is(resolve_raw_input_path('src/foo/bar/'), targetDir + '/');
	t.is(resolve_raw_input_path('./src/foo/bar'), targetDir);
	t.is(resolve_raw_input_path('./src/foo/bar/'), targetDir + '/');
	t.is.not(resolve_raw_input_path('bar'), targetDir);
});

test_resolve_raw_input_path.run();
/* /test_resolve_raw_input_path */

/* test_resolve_raw_input_paths */
const test_resolve_raw_input_paths = suite('resolve_raw_input_paths');

test_resolve_raw_input_paths('resolves multiple input path forms', () => {
	t.equal(resolve_raw_input_paths(['foo/bar.ts', 'baz', './']), [
		resolve('src/foo/bar.ts'),
		resolve('src/baz'),
		resolve('src') + sep,
	]);
});

test_resolve_raw_input_paths('default to src', () => {
	t.equal(resolve_raw_input_paths([]), [resolve('src') + sep]);
});

test_resolve_raw_input_paths.run();
/* /test_resolve_raw_input_paths */

/* test_get_possible_source_ids */
const test_get_possible_source_ids = suite('get_possible_source_ids');

test_get_possible_source_ids('in the gro directory', () => {
	const input_path = resolve('src/foo/bar');
	t.equal(get_possible_source_ids(input_path, ['.baz.ts']), [input_path, input_path + '.baz.ts']);
});

test_get_possible_source_ids('does not repeat the extension', () => {
	const input_path = resolve('src/foo/bar.baz.ts');
	t.equal(get_possible_source_ids(input_path, ['.baz.ts']), [input_path]);
});

test_get_possible_source_ids('does not repeat with the same root directory', () => {
	const input_path = resolve('src/foo/bar.baz.ts');
	t.equal(get_possible_source_ids(input_path, ['.baz.ts'], [paths.root, paths.root]), [input_path]);
});

test_get_possible_source_ids('implied to be a directory by trailing slash', () => {
	const input_path = resolve('src/foo/bar') + sep;
	t.equal(get_possible_source_ids(input_path, ['.baz.ts']), [input_path]);
});

test_get_possible_source_ids('in both another directory and gro', () => {
	const fakeDir = resolve('../fake') + sep;
	const fakePaths = create_paths(fakeDir);
	const input_path = join(fakeDir, 'src/foo/bar');
	t.equal(get_possible_source_ids(input_path, ['.baz.ts'], [gro_paths.root], fakePaths), [
		input_path,
		input_path + '.baz.ts',
		replace_root_dir(input_path, gro_paths.root, fakePaths),
		replace_root_dir(input_path, gro_paths.root, fakePaths) + '.baz.ts',
	]);
});

test_get_possible_source_ids.run();
/* /test_get_possible_source_ids */

/* test_load_source_path_data_by_input_path */
const test_load_source_path_data_by_input_path = suite('load_source_path_data_by_input_path');

test_load_source_path_data_by_input_path(
	'loads source path data and handles missing paths',
	async () => {
		const result = await load_source_path_data_by_input_path(
			{
				...fs,
				exists: async (path) => path !== 'fake/test3.bar.ts' && !path.startsWith('fake/missing'),
				stat: async (path) =>
					({
						isDirectory: () => path === 'fake/test2' || path === 'fake/test3',
					} as any),
			},
			['fake/test1.bar.ts', 'fake/test2', 'fake/test3', 'fake/missing'],
			(input_path) => get_possible_source_ids(input_path, ['.bar.ts']),
		);
		t.equal(result, {
			source_id_path_data_by_input_path: new Map([
				['fake/test1.bar.ts', {id: 'fake/test1.bar.ts', isDirectory: false}],
				['fake/test2', {id: 'fake/test2.bar.ts', isDirectory: false}],
				['fake/test3', {id: 'fake/test3', isDirectory: true}],
			]),
			unmapped_input_paths: ['fake/missing'],
		});
	},
);

test_load_source_path_data_by_input_path.run();
/* /test_load_source_path_data_by_input_path */

/* test_load_source_ids_by_input_path */
const test_load_source_ids_by_input_path = suite('load_source_ids_by_input_path', async () => {
	const testFiles: Record<string, Map<string, Path_Stats>> = {
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
		async (id) => testFiles[id],
	);
	t.equal(result, {
		source_ids_by_input_path: new Map([
			['fake/test1.bar.ts', ['fake/test1.bar.ts']],
			['fake/test2', ['fake/test2.bar.ts']],
			['fake/test3', ['fake/test3/a.ts', 'fake/test3/b.ts']],
			['fake', ['fake/test3/c.ts']],
		]),
		input_directories_with_no_files: ['fake/nomatches'],
	});
});

test_load_source_ids_by_input_path.run();
/* /test_load_source_ids_by_input_path */
