import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {dirname, resolve} from 'path';
import {stripTrailingSlash} from '@feltcoop/felt/util/path.js';
import {toPathParts} from '@feltcoop/felt/util/pathParsing.js';

import {fs as memoryFs, MemoryFs} from './memory.js';
import {toFsId} from './filesystem.js';
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

const fakeTsContent = 'export const a = 5;';

/* testWriteFile */
const testWriteFile = suite('writeFile', suiteContext);
testWriteFile.before.each(resetMemoryFs);

testWriteFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		t.is(fs._files.size, 0);
		const content = 'hi';
		await fs.writeFile(path, content, 'utf8');
		t.is(fs._files.size, toPathParts(toFsId(path)).length + 1);
		t.is(fs._find(toFsId(path))!.content, content);
	}
});

testWriteFile('updates an existing file', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		t.is(fs._files.size, 0);
		const content1 = 'content1';
		await fs.writeFile(path, content1, 'utf8');
		const {size} = fs._files;
		t.is(size, toPathParts(toFsId(path)).length + 1);
		t.is(fs._find(toFsId(path))!.content, content1);
		const content2 = 'content2';
		await fs.writeFile(path, content2, 'utf8');
		t.is(fs._files.size, size); // count has not changed
		t.is(fs._find(toFsId(path))!.content, content2);
	}
});

// TODO testExists

// TODO test that it creates the in-between directories
// this will break the `length` checks!! can use the new length checks to check segment creation

testWriteFile.run();
/* /testWriteFile */

/* testReadFile */
const testReadFile = suite('readFile', suiteContext);
testReadFile.before.each(resetMemoryFs);

testReadFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		const content = 'content';
		await fs.writeFile(path, content, 'utf8');
		const found = await fs.readFile(path, 'utf8');
		t.is(content, found);
	}
});

testReadFile('missing file throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		fs._reset();
		await fs.readFile('/missing/file', 'utf8');
	} catch (err) {
		return;
	}
	throw Error();
});

testReadFile.run();
/* /testReadFile */

/* testRemove */
const testRemove = suite('remove', suiteContext);
testRemove.before.each(resetMemoryFs);

testRemove('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		await fs.remove(path);
		t.ok(!fs._exists(path));
	}
});

testRemove('removes contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
	t.is(fs._files.size, 10);
	await fs.remove(`${path}/dir1`);
	t.is(fs._files.size, 6);
});

testRemove('missing file fails silently', async ({fs}) => {
	await fs.remove('/missing/file');
});

testRemove.run();
/* /testRemove */

/* testMove */
const testMove = suite('move', suiteContext);
testMove.before.each(resetMemoryFs);

testMove('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		t.ok(!fs._exists(dest));
		await fs.move(path, dest);
		t.ok(!fs._exists(path));
		t.ok(fs._exists(dest));
	}
});

testMove('moves contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
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

testMove('handles move conflict with overwrite false', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
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

testMove('handles move conflict with overwrite true', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
	t.is(fs._files.size, 5);
	await fs.move(path1, path2, {overwrite: true});
	t.ok(!fs._exists(path1));
	t.ok(fs._exists(path2));
	t.is(fs._files.size, 4);
});

testMove('missing source path throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		await fs.move('/missing/file', '/');
	} catch (err) {
		return;
	}
	throw Error();
});

testMove.run();
/* /testMove */

/* testCopy */
const testCopy = suite('copy', suiteContext);
testCopy.before.each(resetMemoryFs);

testCopy('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		t.ok(!fs._exists(dest));
		await fs.copy(path, dest);
		t.ok(fs._exists(path));
		t.ok(fs._exists(dest));
	}
});

testCopy('copies contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/IGNORE.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
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

testCopy('handles copy conflict with overwrite false', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
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

testCopy('handles copy conflict with overwrite true', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
	t.is(fs._files.size, 5);
	await fs.copy(path1, path2, {overwrite: true});
	t.ok(fs._exists(path1));
	t.ok(fs._exists(path2));
	t.is(fs._files.size, 5);
});

testCopy('missing source path throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		await fs.copy('/missing/file', '/');
	} catch (err) {
		return;
	}
	throw Error();
});

testCopy.run();
/* /testCopy */

/* testEnsureDir */
const testEnsureDir = suite('ensureDir', suiteContext);
testEnsureDir.before.each(resetMemoryFs);

testEnsureDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		t.ok(!fs._exists(path));
		await fs.ensureDir(path);
		t.ok(fs._exists(path));
	}
});

testEnsureDir('normalize paths', async ({fs}) => {
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

testEnsureDir.run();
/* /testEnsureDir */

/* testReadDir */
const testReadDir = suite('readDir', suiteContext);
testReadDir.before.each(resetMemoryFs);

testReadDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		const dir = dirname(path);
		const paths = await fs.readDir(dir);
		t.ok(paths.length);
	}
});

testReadDir('readDirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/d`, fakeTsContent);
	const paths = await fs.readDir(`${path}/dir1`);
	t.equal(paths, ['a.ts', 'b', 'b/c1.ts', 'b/c2.ts', 'b/c3.ts', 'd']);
});

testReadDir('missing file fails silently', async ({fs}) => {
	const paths = await fs.readDir('/missing/file');
	t.equal(paths, []);
	t.is(fs._files.size, 0);
});

testReadDir.run();
/* /testReadDir */

/* testEmptyDir */
const testEmptyDir = suite('emptyDir', suiteContext);
testEmptyDir.before.each(resetMemoryFs);

testEmptyDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
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

testEmptyDir('emptyDirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
	t.is(fs._files.size, 12);
	await fs.emptyDir(`${path}/dir1`);
	t.is(fs._files.size, 7);
	t.ok(fs._exists(`${path}/dir1`));
});

testEmptyDir('missing file fails silently', async ({fs}) => {
	await fs.emptyDir('/missing/file');
});

testEmptyDir.run();
/* /testEmptyDir */

/* testFindFiles */
const testFindFiles = suite('findFiles', suiteContext);
testFindFiles.before.each(resetMemoryFs);

testFindFiles('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		const content = 'content';
		await fs.writeFile(path, content, 'utf8');
		let filterCallCount = 0;
		const files = await fs.findFiles('.', () => (filterCallCount++, true));
		const rootPath = toRootPath(toFsId(path));
		t.is(filterCallCount, files.size);
		t.is(files.size, rootPath.split('/').length);
		t.ok(files.has(rootPath));
	}
});

testFindFiles('find a bunch of files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	const ignoredPath = 'b/c2.ts';
	let hasIgnoredPath = false;
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContent);
	await fs.ensureDir(`${path}/dir1/d`);
	await fs.ensureDir(`${path}/dir1/e/f`);
	await fs.writeFile(`${path}/dir2/2.ts`, fakeTsContent);
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

testFindFiles.run();
/* /testFindFiles */
