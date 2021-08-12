import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {dirname, resolve} from 'path';
import {strip_trailing_slash} from '@feltcoop/felt/util/path.js';
import {to_path_parts} from '@feltcoop/felt/util/path_parsing.js';

import {fs as memory_fs, MemoryFs} from './memory.js';
import {to_fs_id} from './filesystem.js';
import {to_root_path} from '../paths.js';

// TODO organize these test suites better
// TODO generic fs test suite

// TODO mount at / and test that path `a` resolves to `/a` (not cwd!)
// then mount at /a and test that path `b` resolves to `/a/b`

// add leading and trailing slash variants
const test_paths = ['a', 'a/b', 'a/b/c']
	.flatMap((p) => [p, resolve(p)])
	.flatMap((p) => [p, `${p}/`]);

interface SuiteContext {
	fs: MemoryFs;
}
const suite_context: SuiteContext = {fs: memory_fs};
const reset_memory_fs = ({fs}: SuiteContext) => fs._reset();

const fake_ts_content = 'export const a = 5;';

/* test_write_file */
const test_write_file = suite('write_file', suite_context);
test_write_file.before.each(reset_memory_fs);

test_write_file('basic behavior', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		t.is(fs._files.size, 0);
		const content = 'hi';
		await fs.write_file(path, content, 'utf8');
		t.is(fs._files.size, to_path_parts(to_fs_id(path)).length + 1);
		t.is(fs._find(to_fs_id(path))!.content, content);
	}
});

test_write_file('updates an existing file', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		t.is(fs._files.size, 0);
		const content1 = 'content1';
		await fs.write_file(path, content1, 'utf8');
		const {size} = fs._files;
		t.is(size, to_path_parts(to_fs_id(path)).length + 1);
		t.is(fs._find(to_fs_id(path))!.content, content1);
		const content2 = 'content2';
		await fs.write_file(path, content2, 'utf8');
		t.is(fs._files.size, size); // count has not changed
		t.is(fs._find(to_fs_id(path))!.content, content2);
	}
});

// TODO test_exists

// TODO test that it creates the in-between directories
// this will break the `length` checks!! can use the new length checks to check segment creation

test_write_file.run();
/* /test_write_file */

/* test_read_file */
const test_read_file = suite('read_file', suite_context);
test_read_file.before.each(reset_memory_fs);

test_read_file('basic behavior', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		const content = 'content';
		await fs.write_file(path, content, 'utf8');
		const found = await fs.read_file(path, 'utf8');
		t.is(content, found);
	}
});

test_read_file('missing file throws', async ({fs}) => {
	// TODO async `t.throws` or `t.rejects` ?
	try {
		fs._reset();
		await fs.read_file('/missing/file', 'utf8');
	} catch (err) {
		return;
	}
	throw Error();
});

test_read_file.run();
/* /test_read_file */

/* test_remove */
const test_remove = suite('remove', suite_context);
test_remove.before.each(reset_memory_fs);

test_remove('basic behavior', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		await fs.write_file(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		await fs.remove(path);
		t.ok(!fs._exists(path));
	}
});

test_remove('removes contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.write_file(`${path}/dir1/a.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir2/d.ts`, fake_ts_content);
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
const test_move = suite('move', suite_context);
test_move.before.each(reset_memory_fs);

test_move('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of test_paths) {
		fs._reset();
		await fs.write_file(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		t.ok(!fs._exists(dest));
		await fs.move(path, dest);
		t.ok(!fs._exists(path));
		t.ok(fs._exists(dest));
	}
});

test_move('moves contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.write_file(`${path}/dir1/a.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir2/d.ts`, fake_ts_content);
	t.is(fs._files.size, 10);
	const new_path = '/a/e';
	await fs.move(`${path}/dir1`, `${new_path}/dir1`); // TODO any special merge behavior?
	t.ok(fs._exists(`${new_path}/dir1`));
	t.ok(fs._exists(`${new_path}/dir1/a.ts`));
	t.ok(fs._exists(`${new_path}/dir1/b`));
	t.ok(fs._exists(`${new_path}/dir1/b/c.ts`));
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
	await fs.write_file(path1, fake_ts_content);
	await fs.write_file(path2, fake_ts_content);
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
	await fs.write_file(path1, fake_ts_content);
	await fs.write_file(path2, fake_ts_content);
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
const test_copy = suite('copy', suite_context);
test_copy.before.each(reset_memory_fs);

test_copy('basic behavior', async ({fs}) => {
	const dest = '/testdest';
	for (const path of test_paths) {
		fs._reset();
		await fs.write_file(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		t.ok(!fs._exists(dest));
		await fs.copy(path, dest);
		t.ok(fs._exists(path));
		t.ok(fs._exists(dest));
	}
});

test_copy('copies contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.write_file(`${path}/dir1/a.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/IGNORE.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir2/d.ts`, fake_ts_content);
	t.is(fs._files.size, 11);
	const new_path = '/a/e';
	await fs.copy(`${path}/dir1`, `${new_path}/dir1`, {
		filter: (id) => Promise.resolve(!id.endsWith('/IGNORE.ts')),
	});
	t.ok(fs._exists(`${new_path}/dir1`));
	t.ok(fs._exists(`${new_path}/dir1/a.ts`));
	t.ok(fs._exists(`${new_path}/dir1/b`));
	t.ok(fs._exists(`${new_path}/dir1/b/c.ts`));
	t.ok(!fs._exists(`${new_path}/dir1/b/IGNORE.ts`));
	t.ok(!fs._exists(`${new_path}/dir2/d.ts`));
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
	await fs.write_file(path1, fake_ts_content);
	await fs.write_file(path2, fake_ts_content);
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
	await fs.write_file(path1, fake_ts_content);
	await fs.write_file(path2, fake_ts_content);
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

/* test_ensure_dir */
const test_ensure_dir = suite('ensure_dir', suite_context);
test_ensure_dir.before.each(reset_memory_fs);

test_ensure_dir('basic behavior', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		t.ok(!fs._exists(path));
		await fs.ensure_dir(path);
		t.ok(fs._exists(path));
	}
});

test_ensure_dir('normalize paths', async ({fs}) => {
	for (const path of test_paths) {
		const test_normalize_paths = async (path1: string, path2: string) => {
			fs._reset();
			t.ok(!fs._exists(path1));
			t.ok(!fs._exists(path2));
			await fs.ensure_dir(path1);
			t.ok(fs._exists(path1));
			t.ok(fs._exists(path2));
		};

		const ends_with_slash = path.endsWith('/');
		// TODO maybe add a `stripLast` instead of this
		const test_path2 = ends_with_slash ? strip_trailing_slash(path) : `${path}/`;
		await test_normalize_paths(
			ends_with_slash ? path : test_path2,
			ends_with_slash ? test_path2 : path,
		);
	}
});

test_ensure_dir.run();
/* /test_ensure_dir */

/* test_read_dir */
const test_read_dir = suite('read_dir', suite_context);
test_read_dir.before.each(reset_memory_fs);

test_read_dir('basic behavior', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		await fs.write_file(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		const dir = dirname(path);
		const paths = await fs.read_dir(dir);
		t.ok(paths.length);
	}
});

test_read_dir('read_dirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.write_file(`${path}/dir1/a.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c1.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c2.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c3.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/d`, fake_ts_content);
	const paths = await fs.read_dir(`${path}/dir1`);
	t.equal(paths, ['a.ts', 'b', 'b/c1.ts', 'b/c2.ts', 'b/c3.ts', 'd']);
});

test_read_dir('missing file fails silently', async ({fs}) => {
	const paths = await fs.read_dir('/missing/file');
	t.equal(paths, []);
	t.is(fs._files.size, 0);
});

test_read_dir.run();
/* /test_read_dir */

/* test_empty_dir */
const test_empty_dir = suite('empty_dir', suite_context);
test_empty_dir.before.each(reset_memory_fs);

test_empty_dir('basic behavior', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		await fs.write_file(path, 'content', 'utf8');
		t.ok(fs._exists(path));
		const {size} = fs._files;
		const dir = dirname(path);
		await fs.empty_dir(dir);
		t.ok(fs._exists(dir));
		t.ok(!fs._exists(path));
		t.ok(size > fs._files.size);
		t.ok(fs._files.size);
	}
});

test_empty_dir('empty_dirs contained files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	await fs.write_file(`${path}/dir1/a.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c1.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c2.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c3.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir2/d.ts`, fake_ts_content);
	t.is(fs._files.size, 12);
	await fs.empty_dir(`${path}/dir1`);
	t.is(fs._files.size, 7);
	t.ok(fs._exists(`${path}/dir1`));
});

test_empty_dir('missing file fails silently', async ({fs}) => {
	await fs.empty_dir('/missing/file');
});

test_empty_dir.run();
/* /test_empty_dir */

/* test_find_files */
const test_find_files = suite('find_files', suite_context);
test_find_files.before.each(reset_memory_fs);

test_find_files('basic behavior', async ({fs}) => {
	for (const path of test_paths) {
		fs._reset();
		const content = 'content';
		await fs.write_file(path, content, 'utf8');
		let filter_call_count = 0;
		const files = await fs.find_files('.', () => (filter_call_count++, true));
		const root_path = to_root_path(to_fs_id(path));
		t.is(filter_call_count, files.size);
		t.is(files.size, root_path.split('/').length);
		t.ok(files.has(root_path));
	}
});

test_find_files('find a bunch of files and dirs', async ({fs}) => {
	const path = '/a/b/c';
	const ignored_path = 'b/c2.ts';
	let has_ignored_path = false;
	await fs.write_file(`${path}/dir1/a.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c1.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c2.ts`, fake_ts_content);
	await fs.write_file(`${path}/dir1/b/c3.ts`, fake_ts_content);
	await fs.ensure_dir(`${path}/dir1/d`);
	await fs.ensure_dir(`${path}/dir1/e/f`);
	await fs.write_file(`${path}/dir2/2.ts`, fake_ts_content);
	const found = await fs.find_files(
		`${path}/dir1`,
		({path}) => {
			if (!has_ignored_path) has_ignored_path = path === ignored_path;
			return path !== ignored_path;
		},
		(a, b) => -a[0].localeCompare(b[0]),
	);
	t.ok(has_ignored_path); // makes sure the test isn't wrong
	t.equal(Array.from(found.keys()), ['e/f', 'e', 'd', 'b/c3.ts', 'b/c1.ts', 'b', 'a.ts']);
});

test_find_files.run();
/* /test_find_files */
