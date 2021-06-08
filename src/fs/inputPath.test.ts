import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, sep, join} from 'path';

import {
	resolveRawInputPath,
	resolveRawInputPaths,
	load_source_path_data_by_input_path,
	load_source_ids_by_input_path,
	getPossibleSourceIds,
} from './inputPath.js';
import type {Path_Stats} from './path_data.js';
import {gro_paths, replace_root_dir, create_paths, paths} from '../paths.js';
import {fs} from './node.js';

/* test_resolveRawInputPath */
const test_resolveRawInputPath = suite('resolveRawInputPath');

test_resolveRawInputPath('basic behavior', () => {
	const target = resolve('src/foo/bar.ts');
	t.is(resolveRawInputPath('foo/bar.ts'), target);
	t.is(resolveRawInputPath('src/foo/bar.ts'), target);
	t.is(resolveRawInputPath('./src/foo/bar.ts'), target);
	t.is(resolveRawInputPath('./foo/bar.ts'), target); // questionable
	t.is(resolveRawInputPath(target), target);
	t.is.not(resolveRawInputPath('bar.ts'), target);
});

test_resolveRawInputPath('source directory', () => {
	const targetDir = resolve('src') + '/'; // inferred as directory
	t.is(resolveRawInputPath('src'), targetDir);
	t.is(resolveRawInputPath('src/'), targetDir);
	t.is(resolveRawInputPath('./src'), targetDir);
	t.is(resolveRawInputPath('./src/'), targetDir);
	t.is(resolveRawInputPath('./srcTest'), targetDir + 'srcTest');
	t.is(resolveRawInputPath('srcTest'), targetDir + 'srcTest');
	t.is.not(resolveRawInputPath('.gro'), targetDir);
});

test_resolveRawInputPath('forced gro directory', () => {
	const fakeDir = resolve('../fake') + sep;
	const fakePaths = create_paths(fakeDir);
	const groTarget = resolve('src/foo/bar.ts');
	t.is(resolveRawInputPath('gro/foo/bar.ts'), groTarget);
	t.is(resolveRawInputPath('foo/bar.ts', fakePaths), join(fakeDir, 'src/foo/bar.ts'));
	t.is(resolveRawInputPath('gro/foo/bar.ts', fakePaths), join(fakeDir, 'src/gro/foo/bar.ts'));
	t.is(resolveRawInputPath('foo/bar.ts'), groTarget);
	t.is(resolveRawInputPath('foo/bar.ts', gro_paths), groTarget);
	t.is(resolveRawInputPath('gro'), resolve('src') + sep);
});

test_resolveRawInputPath('directories', () => {
	const targetDir = resolve('src/foo/bar');
	t.is(resolveRawInputPath('foo/bar'), targetDir);
	t.is(resolveRawInputPath('foo/bar/'), targetDir + '/');
	t.is(resolveRawInputPath('src/foo/bar'), targetDir);
	t.is(resolveRawInputPath('src/foo/bar/'), targetDir + '/');
	t.is(resolveRawInputPath('./src/foo/bar'), targetDir);
	t.is(resolveRawInputPath('./src/foo/bar/'), targetDir + '/');
	t.is.not(resolveRawInputPath('bar'), targetDir);
});

test_resolveRawInputPath.run();
/* /test_resolveRawInputPath */

/* test_resolveRawInputPaths */
const test_resolveRawInputPaths = suite('resolveRawInputPaths');

test_resolveRawInputPaths('resolves multiple input path forms', () => {
	t.equal(resolveRawInputPaths(['foo/bar.ts', 'baz', './']), [
		resolve('src/foo/bar.ts'),
		resolve('src/baz'),
		resolve('src') + sep,
	]);
});

test_resolveRawInputPaths('default to src', () => {
	t.equal(resolveRawInputPaths([]), [resolve('src') + sep]);
});

test_resolveRawInputPaths.run();
/* /test_resolveRawInputPaths */

/* test_getPossibleSourceIds */
const test_getPossibleSourceIds = suite('getPossibleSourceIds');

test_getPossibleSourceIds('in the gro directory', () => {
	const inputPath = resolve('src/foo/bar');
	t.equal(getPossibleSourceIds(inputPath, ['.baz.ts']), [inputPath, inputPath + '.baz.ts']);
});

test_getPossibleSourceIds('does not repeat the extension', () => {
	const inputPath = resolve('src/foo/bar.baz.ts');
	t.equal(getPossibleSourceIds(inputPath, ['.baz.ts']), [inputPath]);
});

test_getPossibleSourceIds('does not repeat with the same root directory', () => {
	const inputPath = resolve('src/foo/bar.baz.ts');
	t.equal(getPossibleSourceIds(inputPath, ['.baz.ts'], [paths.root, paths.root]), [inputPath]);
});

test_getPossibleSourceIds('implied to be a directory by trailing slash', () => {
	const inputPath = resolve('src/foo/bar') + sep;
	t.equal(getPossibleSourceIds(inputPath, ['.baz.ts']), [inputPath]);
});

test_getPossibleSourceIds('in both another directory and gro', () => {
	const fakeDir = resolve('../fake') + sep;
	const fakePaths = create_paths(fakeDir);
	const inputPath = join(fakeDir, 'src/foo/bar');
	t.equal(getPossibleSourceIds(inputPath, ['.baz.ts'], [gro_paths.root], fakePaths), [
		inputPath,
		inputPath + '.baz.ts',
		replace_root_dir(inputPath, gro_paths.root, fakePaths),
		replace_root_dir(inputPath, gro_paths.root, fakePaths) + '.baz.ts',
	]);
});

test_getPossibleSourceIds.run();
/* /test_getPossibleSourceIds */

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
			(inputPath) => getPossibleSourceIds(inputPath, ['.bar.ts']),
		);
		t.equal(result, {
			source_id_path_data_by_input_path: new Map([
				['fake/test1.bar.ts', {id: 'fake/test1.bar.ts', isDirectory: false}],
				['fake/test2', {id: 'fake/test2.bar.ts', isDirectory: false}],
				['fake/test3', {id: 'fake/test3', isDirectory: true}],
			]),
			unmappedInputPaths: ['fake/missing'],
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
