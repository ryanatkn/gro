import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {dirname, resolve} from 'path';
import {stripTrailingSlash} from '@feltcoop/util/path.js';
import {toPathParts} from '@feltcoop/util/pathParsing.js';

import {fs as memoryFs, type MemoryFs} from './memory.js';
import {toFsId} from './filesystem.js';
import {toRootPath} from '../paths.js';

/* eslint-disable no-await-in-loop */

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

/* test__writeFile */
const test__writeFile = suite('writeFile', suiteContext);
test__writeFile.before.each(resetMemoryFs);

test__writeFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		assert.is(fs._files.size, 0);
		const content = 'hi';
		await fs.writeFile(path, content, 'utf8');
		assert.is(fs._files.size, toPathParts(toFsId(path)).length + 1);
		assert.is(fs._find(toFsId(path))!.content, content);
	}
});

test__writeFile('updates an existing file', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		assert.is(fs._files.size, 0);
		const content1 = 'content1';
		await fs.writeFile(path, content1, 'utf8');
		const {size} = fs._files;
		assert.is(size, toPathParts(toFsId(path)).length + 1);
		assert.is(fs._find(toFsId(path))!.content, content1);
		const content2 = 'content2';
		await fs.writeFile(path, content2, 'utf8');
		assert.is(fs._files.size, size); // count has not changed
		assert.is(fs._find(toFsId(path))!.content, content2);
	}
});

// TODO testExists

// TODO test that it creates the in-between directories
// this will break the `length` checks!! can use the new length checks to check segment creation

test__writeFile.run();
/* test__writeFile */

/* test__readFile */
const test__readFile = suite('readFile', suiteContext);
test__readFile.before.each(resetMemoryFs);

test__readFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		const content = 'content';
		await fs.writeFile(path, content, 'utf8');
		const found = await fs.readFile(path, 'utf8');
		assert.is(content, found);
	}
});

test__readFile('missing file throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		fs._reset();
		await fs.readFile('/missing/file', 'utf8');
	} catch (err) {
		return;
	}
	throw Error();
});

test__readFile.run();
/* test__readFile */

/* test_remove */
const test_remove = suite('remove', suiteContext);
test_remove.before.each(resetMemoryFs);

test_remove('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		assert.ok(await fs.exists(path));
		await fs.remove(path);
		assert.ok(!(await fs.exists(path)));
	}
});

test_remove('removes contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
	assert.is(fs._files.size, 10);
	await fs.remove(`${path}/dir1`);
	assert.is(fs._files.size, 6);
});

test_remove('missing file fails silently', async ({fs}) => {
	await fs.remove('/missing/file');
});

test_remove.run();
/* test_remove */

/* test__move */
const test__move = suite('move', suiteContext);
test__move.before.each(resetMemoryFs);

test__move('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		assert.ok(await fs.exists(path));
		assert.ok(!(await fs.exists(dest)));
		await fs.move(path, dest);
		assert.ok(!(await fs.exists(path)));
		assert.ok(await fs.exists(dest));
	}
});

test__move('moves contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
	assert.is(fs._files.size, 10);
	const newPath = '/a/e';
	await fs.move(`${path}/dir1`, `${newPath}/dir1`); // TODO any special merge behavior?
	assert.ok(await fs.exists(`${newPath}/dir1`));
	assert.ok(await fs.exists(`${newPath}/dir1/a.ts`));
	assert.ok(await fs.exists(`${newPath}/dir1/b`));
	assert.ok(await fs.exists(`${newPath}/dir1/b/c.ts`));
	assert.ok(await fs.exists(`${path}/dir2/d.ts`));
	assert.ok(!(await fs.exists(`${path}/dir1`)));
	assert.ok(!(await fs.exists(`${path}/dir1/a.ts`)));
	assert.ok(!(await fs.exists(`${path}/dir1/b`)));
	assert.ok(!(await fs.exists(`${path}/dir1/b/c.ts`)));
	assert.is(fs._files.size, 11); // add the one new base dir
});

test__move('handles move conflict with overwrite false', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
	assert.is(fs._files.size, 5);
	// TODO async `t.throws` or `t.rejects` ?
	let failed = true;
	try {
		await fs.move(path1, path2);
	} catch (err) {
		failed = false;
	}
	if (failed) throw Error();
	assert.ok(await fs.exists(path1));
	assert.ok(await fs.exists(path2));
	assert.is(fs._files.size, 5);
});

test__move('handles move conflict with overwrite true', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
	assert.is(fs._files.size, 5);
	await fs.move(path1, path2, {overwrite: true});
	assert.ok(!(await fs.exists(path1)));
	assert.ok(await fs.exists(path2));
	assert.is(fs._files.size, 4);
});

test__move('missing source path throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		await fs.move('/missing/file', '/');
	} catch (err) {
		return;
	}
	throw Error();
});

test__move.run();
/* test__move */

/* test__copy */
const test__copy = suite('copy', suiteContext);
test__copy.before.each(resetMemoryFs);

test__copy('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		assert.ok(await fs.exists(path));
		assert.ok(!(await fs.exists(dest)));
		await fs.copy(path, dest);
		assert.ok(await fs.exists(path));
		assert.ok(await fs.exists(dest));
	}
});

test__copy('copies contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/IGNORE.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
	assert.is(fs._files.size, 11);
	const newPath = '/a/e';
	await fs.copy(`${path}/dir1`, `${newPath}/dir1`, {
		filter: (id) => Promise.resolve(!id.endsWith('/IGNORE.ts')),
	});
	assert.ok(await fs.exists(`${newPath}/dir1`));
	assert.ok(await fs.exists(`${newPath}/dir1/a.ts`));
	assert.ok(await fs.exists(`${newPath}/dir1/b`));
	assert.ok(await fs.exists(`${newPath}/dir1/b/c.ts`));
	assert.ok(!(await fs.exists(`${newPath}/dir1/b/IGNORE.ts`)));
	assert.ok(!(await fs.exists(`${newPath}/dir2/d.ts`)));
	assert.ok(await fs.exists(`${path}/dir2/d.ts`));
	assert.ok(await fs.exists(`${path}/dir1`));
	assert.ok(await fs.exists(`${path}/dir1/a.ts`));
	assert.ok(await fs.exists(`${path}/dir1/b`));
	assert.ok(await fs.exists(`${path}/dir1/b/c.ts`));
	assert.ok(await fs.exists(`${path}/dir1/b/IGNORE.ts`));
	assert.is(fs._files.size, 16); // add the one new base dir
});

test__copy('handles copy conflict with overwrite false', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
	assert.is(fs._files.size, 5);
	// TODO async `t.throws`
	let failed = true;
	try {
		await fs.copy(path1, path2);
	} catch (err) {
		failed = false;
	}
	if (failed) throw Error();
	assert.ok(await fs.exists(path1));
	assert.ok(await fs.exists(path2));
	assert.is(fs._files.size, 5);
});

test__copy('handles copy conflict with overwrite true', async ({fs}) => {
	const dir = '/a/b';
	const filename1 = '1.ts';
	const filename2 = '2.ts';
	const path1 = `${dir}/${filename1}`;
	const path2 = `${dir}/${filename2}`;
	await fs.writeFile(path1, fakeTsContent);
	await fs.writeFile(path2, fakeTsContent);
	assert.is(fs._files.size, 5);
	await fs.copy(path1, path2, {overwrite: true});
	assert.ok(await fs.exists(path1));
	assert.ok(await fs.exists(path2));
	assert.is(fs._files.size, 5);
});

test__copy('missing source path throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		await fs.copy('/missing/file', '/');
	} catch (err) {
		return;
	}
	throw Error();
});

test__copy.run();
/* test__copy */

/* test__ensureDir */
const test__ensureDir = suite('ensureDir', suiteContext);
test__ensureDir.before.each(resetMemoryFs);

test__ensureDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		assert.ok(!(await fs.exists(path)));
		await fs.ensureDir(path);
		assert.ok(await fs.exists(path));
	}
});

test__ensureDir('normalize paths', async ({fs}) => {
	for (const path of testPaths) {
		const testNormalizePaths = async (path1: string, path2: string) => {
			fs._reset();
			assert.ok(!(await fs.exists(path1)));
			assert.ok(!(await fs.exists(path2)));
			await fs.ensureDir(path1);
			assert.ok(await fs.exists(path1));
			assert.ok(await fs.exists(path2));
		};

		const endsWithSlash = path.endsWith('/');
		// TODO maybe add a `stripLast` instead of this
		const testPath2 = endsWithSlash ? stripTrailingSlash(path) : `${path}/`;
		await testNormalizePaths(endsWithSlash ? path : testPath2, endsWithSlash ? testPath2 : path);
	}
});

test__ensureDir.run();
/* test__ensureDir */

/* test__readDir */
const test__readDir = suite('readDir', suiteContext);
test__readDir.before.each(resetMemoryFs);

test__readDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		assert.ok(await fs.exists(path));
		const dir = dirname(path);
		const paths = await fs.readDir(dir);
		assert.ok(paths.length);
	}
});

test__readDir('readDirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/d`, fakeTsContent);
	const paths = await fs.readDir(`${path}/dir1`);
	assert.equal(paths, ['a.ts', 'b', 'b/c1.ts', 'b/c2.ts', 'b/c3.ts', 'd']);
});

test__readDir('missing file fails silently', async ({fs}) => {
	const paths = await fs.readDir('/missing/file');
	assert.equal(paths, []);
	assert.is(fs._files.size, 0);
});

test__readDir.run();
/* test__readDir */

/* test__emptyDir */
const test__emptyDir = suite('emptyDir', suiteContext);
test__emptyDir.before.each(resetMemoryFs);

test__emptyDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		await fs.writeFile(path, 'content', 'utf8');
		assert.ok(await fs.exists(path));
		const {size} = fs._files;
		const dir = dirname(path);
		await fs.emptyDir(dir);
		assert.ok(await fs.exists(dir));
		assert.ok(!(await fs.exists(path)));
		assert.ok(size > fs._files.size);
		assert.ok(fs._files.size);
	}
});

test__emptyDir('emptyDirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.writeFile(`${path}/dir1/a.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c1.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c2.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir1/b/c3.ts`, fakeTsContent);
	await fs.writeFile(`${path}/dir2/d.ts`, fakeTsContent);
	assert.is(fs._files.size, 12);
	await fs.emptyDir(`${path}/dir1`);
	assert.is(fs._files.size, 7);
	assert.ok(await fs.exists(`${path}/dir1`));
});

test__emptyDir('missing file fails silently', async ({fs}) => {
	await fs.emptyDir('/missing/file');
});

test__emptyDir.run();
/* test__emptyDir */

/* test__findFiles */
const test__findFiles = suite('findFiles', suiteContext);
test__findFiles.before.each(resetMemoryFs);

test__findFiles('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		fs._reset();
		const content = 'content';
		await fs.writeFile(path, content, 'utf8');
		let filterCallCount = 0;
		const files = await fs.findFiles('.', () => (filterCallCount++, true));
		const rootPath = toRootPath(toFsId(path));
		assert.is(filterCallCount, files.size);
		assert.is(files.size, rootPath.split('/').length);
		assert.ok(files.has(rootPath));
	}
});

test__findFiles('find a bunch of files and dirs', async ({fs}) => {
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
	assert.ok(hasIgnoredPath); // makes sure the test isn't wrong
	assert.equal(Array.from(found.keys()), ['e/f', 'e', 'd', 'b/c3.ts', 'b/c1.ts', 'b', 'a.ts']);
});

test__findFiles.run();
/* test__findFiles */
