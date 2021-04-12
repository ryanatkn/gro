import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {fs as memoryFs, MemoryFs} from './memory.js';
import {toFsId} from './filesystem.js';
import {stripEnd} from '../utils/string.js';

// TODO reset the fs between calls, or suites, or something
// having a fresh one each time seems really useful to see the totality of what e.g. the Filer is doing

// TODO organize these test suites better
// TODO generic fs test suite

// TODO mount at / and test that path `a` resolves to `/a` (not cwd!)
// then mount at /a and test that path `b` resolves to `/a/b`

// add leading and trailing slash variants
const testPaths = ['a', 'a/b', 'a/b/c'].flatMap((p) => [p, `/${p}`]).flatMap((p) => [p, `${p}/`]);

interface SuiteContext {
	fs: MemoryFs;
}
const suiteContext: SuiteContext = {fs: memoryFs};

const resetMemoryFs = ({fs}: SuiteContext) => {
	fs._reset();
};

const fakeTsContents = 'export const a = 5;';

/* test_outputFile */
const test_outputFile = suite('outputFile', suiteContext);
test_outputFile.before.each(resetMemoryFs);

test_outputFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		t.is(fs._files.size, 0);
		const contents = 'hi';
		await fs.outputFile(path, contents, 'utf8');
		t.ok(fs._files.size);
		t.is(fs._find(toFsId(path))!.contents, contents);
		fs._reset();
	}
});

test_outputFile('updates an existing file', async ({fs}) => {
	for (const path of testPaths) {
		t.is(fs._files.size, 0);
		const contents1 = 'contents1';
		await fs.outputFile(path, contents1, 'utf8');
		const {size} = fs._files;
		t.ok(size);
		t.is(fs._find(toFsId(path))!.contents, contents1);
		const contents2 = 'contents2';
		await fs.outputFile(path, contents2, 'utf8');
		t.is(fs._files.size, size); // count has not changed
		t.is(fs._find(toFsId(path))!.contents, contents2);
		fs._reset();
	}
});

// TODO test that it creates the in-between directories
// this will break the `length` checks!! can use the new length checks to check segment creation

test_outputFile.run();
/* /test_outputFile */

/* test_readFile */
const test_readFile = suite('readFile', suiteContext);
test_readFile.before.each(resetMemoryFs);

test_readFile('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		const contents = 'contents';
		await fs.outputFile(path, contents, 'utf8');
		const found = await fs.readFile(path, 'utf8');
		t.is(contents, found);
		fs._reset();
	}
});

test_readFile('missing file throws', async ({fs}) => {
	// TODO async `t.throws` ? hmm
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

/* test_readJson */
const test_readJson = suite('readJson', suiteContext);
test_readJson.before.each(resetMemoryFs);

test_readJson('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		const contents = {contents: {deep: {1: 1}}};
		await fs.outputFile(path, JSON.stringify(contents), 'utf8');
		const found = await fs.readJson(path);
		t.equal(contents, found);
		fs._reset();
	}
});

test_readJson('missing file throws', async ({fs}) => {
	// TODO async `t.throws` ? hmm
	try {
		fs._reset();
		await fs.readJson('/missing/file');
	} catch (err) {
		return;
	}
	throw Error();
});

test_readJson.run();
/* /test_readJson */

/* test_remove */
const test_remove = suite('remove', suiteContext);
test_remove.before.each(resetMemoryFs);

test_remove('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		await fs.outputFile(path, 'contents', 'utf8');
		t.ok(await fs.pathExists(path));
		await fs.remove(path);
		t.ok(!(await fs.pathExists(path)));
	}
});

test_remove('removes contained files and dirs', async ({fs}) => {
	fs._reset();
	const path = '/a/b/c';
	await fs.outputFile(`${path}/dir1/a.ts`, fakeTsContents);
	await fs.outputFile(`${path}/dir1/b/c.ts`, fakeTsContents);
	await fs.outputFile(`${path}/dir2/d.ts`, fakeTsContents);
	t.is(fs._files.size, 9);
	await fs.remove(`${path}/dir1`);
	t.is(fs._files.size, 5);
});

test_remove('missing file fails silently', async ({fs}) => {
	fs._reset();
	await fs.remove('/missing/file');
});

test_remove.run();
/* /test_remove */

/* test_findFiles */
const test_findFiles = suite('findFiles', suiteContext);
test_findFiles.before.each(resetMemoryFs);

test_findFiles('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		const contents = 'contents';
		await fs.outputFile(path, contents, 'utf8');
		const files = await fs.findFiles(path);
		t.is(files.size, 1);
		t.ok(files.has(toFsId(path)));
		fs._reset();
	}
});

test_findFiles.run();
/* /test_findFiles */

/* test_ensureDir */
const test_ensureDir = suite('ensureDir', suiteContext);
test_ensureDir.before.each(resetMemoryFs);

test_ensureDir('basic behavior', async ({fs}) => {
	for (const path of testPaths) {
		t.ok(!(await fs.pathExists(path)));
		await fs.ensureDir(path);
		t.ok(await fs.pathExists(path));
		fs._reset();
	}
});

test_ensureDir('normalize paths', async ({fs}) => {
	for (const path of testPaths) {
		const testNormalizePaths = async (path1: string, path2: string) => {
			t.ok(!(await fs.pathExists(path1)));
			t.ok(!(await fs.pathExists(path2)));
			await fs.ensureDir(path1);
			t.ok(await fs.pathExists(path1));
			t.ok(await fs.pathExists(path2));
			fs._reset();
		};

		const endsWithSlash = path.endsWith('/');
		// TODO maybe add a `stripLast` instead of this
		const testPath2 = endsWithSlash ? stripEnd(path, '/') : `${path}/`;
		await testNormalizePaths(endsWithSlash ? path : testPath2, endsWithSlash ? testPath2 : path);
	}
});

test_ensureDir.run();
/* /test_ensureDir */
