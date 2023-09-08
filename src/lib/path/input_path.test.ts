import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';
import 'source-map-support/register.js'; // TODO do this generically (how to pass to uvu as CLI arg?)

import {
	resolveRawInputPath,
	resolve_raw_input_paths,
	load_source_path_data_by_input_path,
	load_source_ids_by_input_path,
	get_possible_source_ids,
} from './input_path.js';
import type {PathStats} from './path_data.js';
import {gro_paths, replace_root_dir, create_paths, paths} from './paths.js';
import {fs} from '../fs/node.js';

/* test__resolveRawInputPath */
const test__resolveRawInputPath = suite('resolveRawInputPath');

test__resolveRawInputPath('basic behavior', () => {
	const target = resolve('src/lib/foo/bar.ts');
	assert.is(resolveRawInputPath('foo/bar.ts'), target);
	assert.is(resolveRawInputPath('src/lib/foo/bar.ts'), target);
	assert.is(resolveRawInputPath('./src/lib/foo/bar.ts'), target);
	assert.is(resolveRawInputPath('./foo/bar.ts'), target); // questionable
	assert.is(resolveRawInputPath(target), target);
	assert.is.not(resolveRawInputPath('bar.ts'), target);
});

test__resolveRawInputPath('source directory', () => {
	const targetDir = resolve('src/lib') + '/'; // inferred as directory
	assert.is(resolveRawInputPath('src/lib'), targetDir);
	assert.is(resolveRawInputPath('src/lib/'), targetDir);
	assert.is(resolveRawInputPath('./src/lib'), targetDir);
	assert.is(resolveRawInputPath('./src/lib/'), targetDir);
	assert.is(resolveRawInputPath('./srcTest'), targetDir + 'srcTest');
	assert.is(resolveRawInputPath('srcTest'), targetDir + 'srcTest');
	assert.is.not(resolveRawInputPath('.gro'), targetDir);
});

test__resolveRawInputPath('forced gro directory', () => {
	const fakeDir = resolve('../fake') + '/';
	const fakePaths = create_paths(fakeDir);
	const groTarget = resolve('src/lib/foo/bar.ts');
	assert.is(resolveRawInputPath('gro/foo/bar.ts'), groTarget);
	assert.is(resolveRawInputPath('foo/bar.ts', fakePaths), join(fakeDir, 'src/lib/foo/bar.ts'));
	assert.is(
		resolveRawInputPath('gro/foo/bar.ts', fakePaths),
		join(fakeDir, 'src/lib/gro/foo/bar.ts'),
	);
	assert.is(resolveRawInputPath('foo/bar.ts'), groTarget);
	assert.is(resolveRawInputPath('foo/bar.ts', gro_paths), groTarget);
	assert.is(resolveRawInputPath('gro'), resolve('src/lib') + '/');
});

test__resolveRawInputPath('directories', () => {
	const targetDir = resolve('src/lib/foo/bar');
	assert.is(resolveRawInputPath('foo/bar'), targetDir);
	assert.is(resolveRawInputPath('foo/bar/'), targetDir);
	assert.is(resolveRawInputPath('src/lib/foo/bar'), targetDir);
	assert.is(resolveRawInputPath('src/lib/foo/bar/'), targetDir);
	assert.is(resolveRawInputPath('./src/lib/foo/bar'), targetDir);
	assert.is(resolveRawInputPath('./src/lib/foo/bar/'), targetDir);
	assert.is.not(resolveRawInputPath('bar'), targetDir);
});

test__resolveRawInputPath.run();
/* test__resolveRawInputPath */

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
	const fakeDir = resolve('../fake') + '/';
	const fakePaths = create_paths(fakeDir);
	const input_path = join(fakeDir, 'src/foo/bar');
	assert.equal(get_possible_source_ids(input_path, ['.baz.ts'], [gro_paths.root], fakePaths), [
		input_path,
		input_path + '.baz.ts',
		input_path + '/bar.baz.ts',
		replace_root_dir(input_path, gro_paths.root, fakePaths),
		replace_root_dir(input_path, gro_paths.root, fakePaths) + '.baz.ts',
		replace_root_dir(input_path, gro_paths.root, fakePaths) + '/bar.baz.ts',
	]);
});

test__get_possible_source_ids.run();
/* test__get_possible_source_ids */

/* test__load_source_path_data_by_input_path */
const test__load_source_path_data_by_input_path = suite('load_source_path_data_by_input_path');

test__load_source_path_data_by_input_path(
	'loads source path data and handles missing paths',
	async () => {
		const result = await load_source_path_data_by_input_path(
			{
				...fs,
				exists: async (path) =>
					path !== 'fake/test3.bar.ts' &&
					path !== 'fake/test4.bar.ts' &&
					path !== 'fake/test4/test4.bar.ts' &&
					!path.startsWith('fake/missing'),
				stat: async (path) =>
					({
						isDirectory: () =>
							path === 'fake/test2' || path === 'fake/test3' || path === 'fake/test4',
					}) as any,
			},
			['fake/test1.bar.ts', 'fake/test2', 'fake/test3', 'fake/test4', 'fake/missing'],
			(input_path) => get_possible_source_ids(input_path, ['.bar.ts']),
		);
		assert.equal(result, {
			source_id_path_data_by_input_path: new Map([
				['fake/test1.bar.ts', {id: 'fake/test1.bar.ts', isDirectory: false}],
				['fake/test2', {id: 'fake/test2.bar.ts', isDirectory: false}],
				['fake/test3', {id: 'fake/test3/test3.bar.ts', isDirectory: false}],
				['fake/test4', {id: 'fake/test4', isDirectory: true}],
			]),
			unmapped_input_paths: ['fake/missing'],
		});
	},
);

test__load_source_path_data_by_input_path.run();
/* test__load_source_path_data_by_input_path */

/* test__load_source_ids_by_input_path */
const test__load_source_ids_by_input_path = suite('load_source_ids_by_input_path', async () => {
	const testFiles: Record<string, Map<string, PathStats>> = {
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
