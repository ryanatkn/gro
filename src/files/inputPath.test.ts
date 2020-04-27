import {resolve, sep} from 'path';

import {test, t} from '../oki/oki.js';
import {
	resolveRawInputPath,
	resolveRawInputPaths,
	loadSourcePathDataByInputPath,
	loadSourceIdsByInputPath,
} from './inputPaths.js';
import {PathStats} from './pathData.js';

test('resolveRawInputPath()', () => {
	const target = resolve('src/foo/bar.ts');
	t.is(resolveRawInputPath('foo/bar.ts'), target);
	t.is(resolveRawInputPath('src/foo/bar.ts'), target);
	t.is(resolveRawInputPath('./src/foo/bar.ts'), target);
	t.is(resolveRawInputPath('./foo/bar.ts'), target); // questionable
	t.is(resolveRawInputPath(target), target);
	t.isNot(resolveRawInputPath('bar.ts'), target);

	test('source directory', () => {
		const targetDir = resolve('src/') + '/'; // inferred as directory
		t.is(resolveRawInputPath('src'), targetDir);
		t.is(resolveRawInputPath('src/'), targetDir);
		t.is(resolveRawInputPath('./src'), targetDir);
		t.is(resolveRawInputPath('./src/'), targetDir);
		t.isNot(resolveRawInputPath('build'), targetDir);
	});

	test('directories', () => {
		const targetDir = resolve('src/foo/bar');
		t.is(resolveRawInputPath('foo/bar'), targetDir);
		t.is(resolveRawInputPath('foo/bar/'), targetDir + '/');
		t.is(resolveRawInputPath('src/foo/bar'), targetDir);
		t.is(resolveRawInputPath('src/foo/bar/'), targetDir + '/');
		t.is(resolveRawInputPath('./src/foo/bar'), targetDir);
		t.is(resolveRawInputPath('./src/foo/bar/'), targetDir + '/');
		t.isNot(resolveRawInputPath('bar'), targetDir);
	});
});

test('resolveRawInputPaths()', () => {
	t.equal(resolveRawInputPaths(['foo/bar.ts', 'baz', './']), [
		resolve('src/foo/bar.ts'),
		resolve('src/baz'),
		resolve('src') + sep,
	]);

	test('default to src', () => {
		t.equal(resolveRawInputPaths([]), [resolve('src') + sep]);
	});
});

test('loadSourcePathDataByInputPath()', async () => {
	const result = await loadSourcePathDataByInputPath(
		['fake/test1.bar.ts', 'fake/test2', 'fake/test3', 'fake/missing'],
		['.bar.ts'],
		async path =>
			path !== 'fake/test3.bar.ts' && !path.startsWith('fake/missing'),
		async path => ({
			isDirectory: () => path === 'fake/test2' || path === 'fake/test3',
		}),
	);
	t.equal(result, {
		sourceIdPathDataByInputPath: new Map([
			['fake/test1.bar.ts', {id: 'fake/test1.bar.ts', isDirectory: false}],
			['fake/test2', {id: 'fake/test2.bar.ts', isDirectory: false}],
			['fake/test3', {id: 'fake/test3', isDirectory: true}],
		]),
		unmappedInputPaths: ['fake/missing'],
	});
});

test('loadSourceIdsByInputPath()', async () => {
	const testFiles: Obj<Map<string, PathStats>> = {
		'fake/test1.bar.ts': new Map([
			['fake/test1.bar.ts', {isDirectory: () => false}],
		]),
		'fake/test2.bar.ts': new Map([
			['fake/test2.bar.ts', {isDirectory: () => false}],
		]),
		'fake/test3': new Map([
			['fake/test3', {isDirectory: () => true}],
			['a.ts', {isDirectory: () => false}],
			['b.ts', {isDirectory: () => false}],
		]),
		'fake/nomatches': new Map([['fake/nomatches', {isDirectory: () => true}]]),
	};
	const result = await loadSourceIdsByInputPath(
		new Map([
			['fake/test1.bar.ts', {id: 'fake/test1.bar.ts', isDirectory: false}],
			['fake/test2', {id: 'fake/test2.bar.ts', isDirectory: false}],
			['fake/test3', {id: 'fake/test3', isDirectory: true}],
			['fake/nomatches', {id: 'fake/nomatches', isDirectory: true}],
		]),
		async id => testFiles[id],
	);
	t.equal(result, {
		sourceIdsByInputPath: new Map([
			['fake/test1.bar.ts', ['fake/test1.bar.ts']],
			['fake/test2', ['fake/test2.bar.ts']],
			['fake/test3', ['fake/test3/a.ts', 'fake/test3/b.ts']],
		]),
		inputDirectoriesWithNoFiles: ['fake/nomatches'],
	});
});
