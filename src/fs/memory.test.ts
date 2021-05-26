import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {dirname, resolve} from 'path';

import {fs as memoryFs, MemoryFs} from './memory.js';
import {toFsId} from './filesystem.js';
import {stripTrailingSlash, toPathParts} from '../utils/path.js';
import {toRootPath} from '../paths.js';

// TODO organize these test suites better
// TODO generic fs test suite

// TODO mount at / and test that path `a` resolves to `/a` (not cwd!)
// then mount at /a and test that path `b` resolves to `/a/b`

// add leading and trailing slash variants
const testPaths = ['a', 'a/b', 'a/b/c']
	.flatMap((p) => [p, resolve(p)])
	.flatMap((p) => [p, `${p}/`]);

interface SuiteContext {
	fs: MemoryFs;
}
const suiteContext: SuiteContext = {fs: memoryFs};
const resetMemoryFs = ({fs}: SuiteContext) => fs._reset();

const fakeTsContents = 'export const a = 5;';

/* test_writeFile */
const test_writeFile = suite('writeFile', suiteContext);
test_writeFile.before.each(resetMemoryFs);

test_writeFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		t.is(fs._files.size, 0);
		const contents = 'hi';
		await fs.writeFile(path, contents, 'utf8');
		t.is(fs._files.size, toPathParts(toFsId(path)).length + 1);
		t.is(fs._find(toFsId(path))!.contents, contents);
	}
});

test_writeFile('updates an existing file', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		t.is(fs._files.size, 0);
		const contents1 = 'contents1';
		await fs.writeFile(path, contents1, 'utf8');
		const {size} = fs._files;
		t.is(size, toPathParts(toFsId(path)).length + 1);
		t.is(fs._find(toFsId(path))!.contents, contents1);
		const contents2 = 'contents2';
		await fs.writeFile(path, contents2, 'utf8');
		t.is(fs._files.size, size); // count has not changed
		t.is(fs._find(toFsId(path))!.contents, contents2);
	}
});

// TODO test_exists

// TODO test that it creates the in-between directories
// this will break the `length` checks!! can use the new length checks to check segment creation

test_writeFile.run();
/* /test_writeFile */

/* test_readFile */
const test_readFile = suite('readFile', suiteContext);
test_readFile.before.each(resetMemoryFs);

test_readFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		const contents = 'contents';
		await fs.writeFile(path, contents, 'utf8');
		const found = await fs.readFile(path, 'utf8');
		t.is(contents, found);
	}
});

test_readFile('missing file throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		fs._reset();
		await fs.readFile('/missing/file', 'utf8');
	} catch (err) {
		return;
	}
	throw Error();
});

test_readFile.run();
/* /test_readFile */

/* test_remove */
const test_remove = suite('remove', suiteContext);
test_remove.before.each(resetMemoryFs);

test_remove('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'contents', 'utf8');
		t.ok(fs._exists(path));
		await fs.remove(path);
		t.ok(!fs._exists(path));
	}
});

test_remove('removes contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContents);
	t.is(fs._files.size, 10);
	await fs.remove(`${path}/dir1`);
	t.is(fs._files.size, 6);
});

test_remove('missing file fails silently', async ({fs}) => {
	await fs.remove('/missing/file');
});

test_remove.run();
/* /test_remove */

/* test_move */
const test_move = suite('move', suiteContext);
test_move.before.each(resetMemoryFs);

test_move('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'contents', 'utf8');
		t.ok(fs._exists(path));
		t.ok(!fs._exists(dest));
		await fs.move(path, dest);
		t.ok(!fs._exists(path));
		t.ok(fs._exists(dest));
	}
});

test_move('moves contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContents);
	t.is(fs._files.size, 10);
	const newPath = '/a/e';
	await fs.move(`${path}/dir1`, `${newPath}/dir1`); // TODO any special merge behavior?
	t.ok(fs._exists(`${newPath}/dir1`));
	t.ok(fs._exists(`${newPath}/dir1/a.ts`));
	t.ok(fs._exists(`${newPath}/dir1/b`));
	t.ok(fs._exists(`${newPath}/dir1/b/c.ts`));
	t.ok(fs._exists(`${path}/dir2/d.ts`));
	t.ok(!fs._exists(`${path}/dir1`));
	t.ok(!fs._exists(`${path}/dir1/a.ts`));
	t.ok(!fs._exists(`${path}/dir1/b`));
	t.ok(!fs._exists(`${path}/dir1/b/c.ts`));
	t.is(fs._files.size, 11); // add the one new base dir
});

test_move('handles move conflict with overwrite false', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContents);
	await fs.writeFile(path2, fakeTsContents);
	t.is(fs._files.size, 5);
	// TODO async `t.throws` or `t.rejects` ?
	let failed = true;
	try {
		await fs.move(path1, path2);
	} catch (err) {
		failed = false;
	}
	if (failed) throw Error();
	t.ok(fs._exists(path1));
	t.ok(fs._exists(path2));
	t.is(fs._files.size, 5);
});

test_move('handles move conflict with overwrite true', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContents);
	await fs.writeFile(path2, fakeTsContents);
	t.is(fs._files.size, 5);
	await fs.move(path1, path2, {overwrite: true});
	t.ok(!fs._exists(path1));
	t.ok(fs._exists(path2));
	t.is(fs._files.size, 4);
});

test_move('missing source path throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		await fs.move('/missing/file', '/');
	} catch (err) {
		return;
	}
	throw Error();
});

test_move.run();
/* /test_move */

/* test_copy */
const test_copy = suite('copy', suiteContext);
test_copy.before.each(resetMemoryFs);

test_copy('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'contents', 'utf8');
		t.ok(fs._exists(path));
		t.ok(!fs._exists(dest));
		await fs.copy(path, dest);
		t.ok(fs._exists(path));
		t.ok(fs._exists(dest));
	}
});

test_copy('copies contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/IGNORE.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContents);
	t.is(fs._files.size, 11);
	const newPath = '/a/e';
	await fs.copy(`${path}/dir1`, `${newPath}/dir1`, {
		filter: (id) => Promise.resolve(!id.endsWith('/IGNORE.ts')),
	});
	t.ok(fs._exists(`${newPath}/dir1`));
	t.ok(fs._exists(`${newPath}/dir1/a.ts`));
	t.ok(fs._exists(`${newPath}/dir1/b`));
	t.ok(fs._exists(`${newPath}/dir1/b/c.ts`));
	t.ok(!fs._exists(`${newPath}/dir1/b/IGNORE.ts`));
	t.ok(!fs._exists(`${newPath}/dir2/d.ts`));
	t.ok(fs._exists(`${path}/dir2/d.ts`));
	t.ok(fs._exists(`${path}/dir1`));
	t.ok(fs._exists(`${path}/dir1/a.ts`));
	t.ok(fs._exists(`${path}/dir1/b`));
	t.ok(fs._exists(`${path}/dir1/b/c.ts`));
	t.ok(fs._exists(`${path}/dir1/b/IGNORE.ts`));
	t.is(fs._files.size, 16); // add the one new base dir
});

test_copy('handles copy conflict with overwrite false', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContents);
	await fs.writeFile(path2, fakeTsContents);
	t.is(fs._files.size, 5);
	// TODO async `t.throws`
	let failed = true;
	try {
		await fs.copy(path1, path2);
	} catch (err) {
		failed = false;
	}
	if (failed) throw Error();
	t.ok(fs._exists(path1));
	t.ok(fs._exists(path2));
	t.is(fs._files.size, 5);
});

test_copy('handles copy conflict with overwrite true', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContents);
	await fs.writeFile(path2, fakeTsContents);
	t.is(fs._files.size, 5);
	await fs.copy(path1, path2, {overwrite: true});
	t.ok(fs._exists(path1));
	t.ok(fs._exists(path2));
	t.is(fs._files.size, 5);
});

test_copy('missing source path throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		await fs.copy('/missing/file', '/');
	} catch (err) {
		return;
	}
	throw Error();
});

test_copy.run();
/* /test_copy */

/* test_ensureDir */
const test_ensureDir = suite('ensureDir', suiteContext);
test_ensureDir.before.each(resetMemoryFs);

test_ensureDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		t.ok(!fs._exists(path));
		await fs.ensureDir(path);
		t.ok(fs._exists(path));
	}
});

test_ensureDir('normalize paths', async ({fs}) => {
	for (const path of testPaths) {
		const testNormalizePaths = async (path1: string, path2: string) => {
			fs._reset();
			t.ok(!fs._exists(path1));
			t.ok(!fs._exists(path2));
			await fs.ensureDir(path1);
			t.ok(fs._exists(path1));
			t.ok(fs._exists(path2));
		};

		const endsWithSlash = path.endsWith('/');
		// TODO maybe add a `stripLast` instead of this
		const testPath2 = endsWithSlash ? stripTrailingSlash(path) : `${path}/`;
		await testNormalizePaths(endsWithSlash ? path : testPath2, endsWithSlash ? testPath2 : path);
	}
});

test_ensureDir.run();
/* /test_ensureDir */

/* test_readDir */
const test_readDir = suite('readDir', suiteContext);
test_readDir.before.each(resetMemoryFs);

test_readDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'contents', 'utf8');
		t.ok(fs._exists(path));
		const dir = dirname(path);
		const paths = await fs.readDir(dir);
		t.ok(paths.length);
	}
});

test_readDir('readDirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/d`, fakeTsContents);
	const paths = await fs.readDir(`${path}/dir1`);
	t.equal(paths, ['a.ts', 'b', 'b/c1.ts', 'b/c2.ts', 'b/c3.ts', 'd']);
});

test_readDir('missing file fails silently', async ({fs}) => {
	const paths = await fs.readDir('/missing/file');
	t.equal(paths, []);
	t.is(fs._files.size, 0);
});

test_readDir.run();
/* /test_readDir */

/* test_emptyDir */
const test_emptyDir = suite('emptyDir', suiteContext);
test_emptyDir.before.each(resetMemoryFs);

test_emptyDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'contents', 'utf8');
		t.ok(fs._exists(path));
		const {size} = fs._files;
		const dir = dirname(path);
		await fs.emptyDir(dir);
		t.ok(fs._exists(dir));
		t.ok(!fs._exists(path));
		t.ok(size > fs._files.size);
		t.ok(fs._files.size);
	}
});

test_emptyDir('emptyDirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContents);
	t.is(fs._files.size, 12);
	await fs.emptyDir(`${path}/dir1`);
	t.is(fs._files.size, 7);
	t.ok(fs._exists(`${path}/dir1`));
});

test_emptyDir('missing file fails silently', async ({fs}) => {
	await fs.emptyDir('/missing/file');
});

test_emptyDir.run();
/* /test_emptyDir */

/* test_findFiles */
const test_findFiles = suite('findFiles', suiteContext);
test_findFiles.before.each(resetMemoryFs);

test_findFiles('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		const contents = 'contents';
		await fs.writeFile(path, contents, 'utf8');
		let filterCallCount = 0;
		const files = await fs.findFiles('.', () => (filterCallCount++, true));
		const rootPath = toRootPath(toFsId(path));
		t.is(filterCallCount, files.size);
		t.is(files.size, rootPath.split('/').length);
		t.ok(files.has(rootPath));
	}
});

test_findFiles('find a bunch of files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	const ignoredPath = 'b/c2.ts';
	let hasIgnoredPath = false;
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContents);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContents);
	await fs.ensureDir(`${path}/dir1/d`);
	await fs.ensureDir(`${path}/dir1/e/f`);
	await fs.writeFile(`${path}/dir2/2.ts`, fakeTsContents);
	const found = await fs.findFiles(
		`${path}/dir1`,
		({path}) => {
			if (!hasIgnoredPath) hasIgnoredPath = path === ignoredPath;
			return path !== ignoredPath;
		},
		(a, b) => -a[0].localeCompare(b[0]),
	);
	t.ok(hasIgnoredPath); // makes sure the test isn't wrong
	t.equal(Array.from(found.keys()), ['e/f', 'e', 'd', 'b/c3.ts', 'b/c1.ts', 'b', 'a.ts']);
});

test_findFiles.run();
/* /test_findFiles */
