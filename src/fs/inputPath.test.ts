import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, sep, join} from 'path';

import {
	resolveRawInputPath,
	resolveRawInputPaths,
	loadSourcePathDataByInputPath,
	loadSourceIdsByInputPath,
	getPossibleSourceIds,
} from './inputPath.js';
import {type PathStats} from 'src/fs/pathData.js';
import {groPaths, replaceRootDir, createPaths, paths} from '../paths.js';
import {fs} from './node.js';

/* test__resolveRawInputPath */
const test__resolveRawInputPath = suite('resolveRawInputPath');

test__resolveRawInputPath('basic behavior', () => {
	const target = resolve('src/foo/bar.ts');
	assert.is(resolveRawInputPath('foo/bar.ts'), target);
	assert.is(resolveRawInputPath('src/foo/bar.ts'), target);
	assert.is(resolveRawInputPath('./src/foo/bar.ts'), target);
	assert.is(resolveRawInputPath('./foo/bar.ts'), target); // questionable
	assert.is(resolveRawInputPath(target), target);
	assert.is.not(resolveRawInputPath('bar.ts'), target);
});

test__resolveRawInputPath('source directory', () => {
	const targetDir = resolve('src') + '/'; // inferred as directory
	assert.is(resolveRawInputPath('src'), targetDir);
	assert.is(resolveRawInputPath('src/'), targetDir);
	assert.is(resolveRawInputPath('./src'), targetDir);
	assert.is(resolveRawInputPath('./src/'), targetDir);
	assert.is(resolveRawInputPath('./srcTest'), targetDir + 'srcTest');
	assert.is(resolveRawInputPath('srcTest'), targetDir + 'srcTest');
	assert.is.not(resolveRawInputPath('.gro'), targetDir);
});

test__resolveRawInputPath('forced gro directory', () => {
	const fakeDir = resolve('../fake') + sep;
	const fakePaths = createPaths(fakeDir);
	const groTarget = resolve('src/foo/bar.ts');
	assert.is(resolveRawInputPath('gro/foo/bar.ts'), groTarget);
	assert.is(resolveRawInputPath('foo/bar.ts', fakePaths), join(fakeDir, 'src/foo/bar.ts'));
	assert.is(resolveRawInputPath('gro/foo/bar.ts', fakePaths), join(fakeDir, 'src/gro/foo/bar.ts'));
	assert.is(resolveRawInputPath('foo/bar.ts'), groTarget);
	assert.is(resolveRawInputPath('foo/bar.ts', groPaths), groTarget);
	assert.is(resolveRawInputPath('gro'), resolve('src') + sep);
});

test__resolveRawInputPath('directories', () => {
	const targetDir = resolve('src/foo/bar');
	assert.is(resolveRawInputPath('foo/bar'), targetDir);
	assert.is(resolveRawInputPath('foo/bar/'), targetDir + '/');
	assert.is(resolveRawInputPath('src/foo/bar'), targetDir);
	assert.is(resolveRawInputPath('src/foo/bar/'), targetDir + '/');
	assert.is(resolveRawInputPath('./src/foo/bar'), targetDir);
	assert.is(resolveRawInputPath('./src/foo/bar/'), targetDir + '/');
	assert.is.not(resolveRawInputPath('bar'), targetDir);
});

test__resolveRawInputPath.run();
/* test__resolveRawInputPath */

/* test__resolveRawInputPaths */
const test__resolveRawInputPaths = suite('resolveRawInputPaths');

test__resolveRawInputPaths('resolves multiple input path forms', () => {
	assert.equal(resolveRawInputPaths(['foo/bar.ts', 'baz', './']), [
		resolve('src/foo/bar.ts'),
		resolve('src/baz'),
		resolve('src') + sep,
	]);
});

test__resolveRawInputPaths('default to src', () => {
	assert.equal(resolveRawInputPaths([]), [resolve('src') + sep]);
});

test__resolveRawInputPaths.run();
/* test__resolveRawInputPaths */

/* test__getPossibleSourceIds */
const test__getPossibleSourceIds = suite('getPossibleSourceIds');

test__getPossibleSourceIds('in the gro directory', () => {
	const inputPath = resolve('src/foo/bar');
	assert.equal(getPossibleSourceIds(inputPath, ['.baz.ts']), [inputPath, inputPath + '.baz.ts']);
});

test__getPossibleSourceIds('does not repeat the extension', () => {
	const inputPath = resolve('src/foo/bar.baz.ts');
	assert.equal(getPossibleSourceIds(inputPath, ['.baz.ts']), [inputPath]);
});

test__getPossibleSourceIds('does not repeat with the same root directory', () => {
	const inputPath = resolve('src/foo/bar.baz.ts');
	assert.equal(getPossibleSourceIds(inputPath, ['.baz.ts'], [paths.root, paths.root]), [inputPath]);
});

test__getPossibleSourceIds('implied to be a directory by trailing slash', () => {
	const inputPath = resolve('src/foo/bar') + sep;
	assert.equal(getPossibleSourceIds(inputPath, ['.baz.ts']), [inputPath]);
});

test__getPossibleSourceIds('in both another directory and gro', () => {
	const fakeDir = resolve('../fake') + sep;
	const fakePaths = createPaths(fakeDir);
	const inputPath = join(fakeDir, 'src/foo/bar');
	assert.equal(getPossibleSourceIds(inputPath, ['.baz.ts'], [groPaths.root], fakePaths), [
		inputPath,
		inputPath + '.baz.ts',
		replaceRootDir(inputPath, groPaths.root, fakePaths),
		replaceRootDir(inputPath, groPaths.root, fakePaths) + '.baz.ts',
	]);
});

test__getPossibleSourceIds.run();
/* test__getPossibleSourceIds */

/* test__loadSourcePathDataByInputPath */
const test__loadSourcePathDataByInputPath = suite('loadSourcePathDataByInputPath');

test__loadSourcePathDataByInputPath(
	'loads source path data and handles missing paths',
	async () => {
		const result = await loadSourcePathDataByInputPath(
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
		assert.equal(result, {
			sourceIdPathDataByInputPath: new Map([
				['fake/test1.bar.ts', {id: 'fake/test1.bar.ts', isDirectory: false}],
				['fake/test2', {id: 'fake/test2.bar.ts', isDirectory: false}],
				['fake/test3', {id: 'fake/test3', isDirectory: true}],
			]),
			unmappedInputPaths: ['fake/missing'],
		});
	},
);

test__loadSourcePathDataByInputPath.run();
/* test__loadSourcePathDataByInputPath */

/* test__loadSourceIdsByInputPath */
const test__loadSourceIdsByInputPath = suite('loadSourceIdsByInputPath', async () => {
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
	const result = await loadSourceIdsByInputPath(
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
		sourceIdsByInputPath: new Map([
			['fake/test1.bar.ts', ['fake/test1.bar.ts']],
			['fake/test2', ['fake/test2.bar.ts']],
			['fake/test3', ['fake/test3/a.ts', 'fake/test3/b.ts']],
			['fake', ['fake/test3/c.ts']],
		]),
		inputDirectoriesWithNoFiles: ['fake/nomatches'],
	});
});

test__loadSourceIdsByInputPath.run();
/* test__loadSourceIdsByInputPath */
