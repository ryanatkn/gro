import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import {find_modules, load_modules, load_module} from './modules.js';
import * as modTest1 from './fixtures/test1.foo.js';
import * as modTestBaz1 from './fixtures/baz1/test1.baz.js';
import * as modTestBaz2 from './fixtures/baz2/test2.baz.js';
import {fs} from './node.js';
import {get_possible_source_ids} from './input_path.js';

/* test_load_module */
const test_load_module = suite('load_module');

test_load_module('basic behavior', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	let validated_mod;
	const result = await load_module(id, ((mod: any) => {
		validated_mod = mod;
		return true;
	}) as any);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.mod, validated_mod);
	t.is(result.mod.mod, modTest1);
});

test_load_module('without validation', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	const result = await load_module(id);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.mod, modTest1);
});

test_load_module('fails validation', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	let validated_mod;
	const test_validation = (mod: Record<string, any>) => {
		validated_mod = mod;
		return false;
	};
	const result = await load_module(id, test_validation as any);
	t.not.ok(result.ok);
	if (result.type === 'invalid') {
		t.is(result.validation, test_validation.name);
		t.is(result.id, id);
		t.is(result.mod, validated_mod);
		t.is(result.mod, modTest1);
	} else {
		throw Error('Should be invalid');
	}
});

test_load_module('fails to import', async () => {
	const id = resolve('foo/test/failure');
	const result = await load_module(id);
	t.not.ok(result.ok);
	if (result.type === 'import_failed') {
		t.is(result.id, id);
		t.ok(result.error instanceof Error);
	} else {
		throw Error('Should fail to import');
	}
});

test_load_module.run();
/* /test_load_module */

/* test_find_modules */
const test_find_modules = suite('find_modules');

test_find_modules('with and without extension', async () => {
	const path1 = resolve('src/fs/fixtures/test1');
	const id1 = resolve('src/fs/fixtures/test1.foo.ts');
	const id2 = resolve('src/fs/fixtures/test2.foo.ts');
	const result = await find_modules(
		fs,
		[path1, id2],
		(id) => fs.find_files(id),
		(input_path) => get_possible_source_ids(input_path, ['.foo.ts']),
	);
	t.ok(result.ok);
	t.equal(
		result.source_ids_by_input_path,
		new Map([
			[path1, [id1]],
			[id2, [id2]],
		]),
	);
	t.equal(
		result.source_id_path_data_by_input_path,
		new Map([
			[path1, {id: id1, isDirectory: false}],
			[id2, {id: id2, isDirectory: false}],
		]),
	);
});

test_find_modules('directory', async () => {
	const id = resolve('src/fs/fixtures/');
	const result = await find_modules(fs, [id], (id) =>
		fs.find_files(id, ({path}) => path.includes('.foo.')),
	);
	t.ok(result.ok);
	t.equal(
		result.source_ids_by_input_path,
		new Map([[id, [join(id, 'test1.foo.ts'), join(id, 'test2.foo.ts')]]]),
	);
	t.equal(result.source_id_path_data_by_input_path, new Map([[id, {id, isDirectory: true}]]));
});

test_find_modules('fail with unmapped_input_paths', async () => {
	const result = await find_modules(
		fs,
		[
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/failme1'),
			resolve('src/fs/fixtures/bar2'),
			resolve('src/fs/fixtures/failme2'),
		],
		(id) => fs.find_files(id),
		(input_path) => get_possible_source_ids(input_path, ['.foo.ts']),
	);
	t.not.ok(result.ok);
	t.ok(result.reasons.length);
	if (result.type === 'unmapped_input_paths') {
		t.equal(result.unmapped_input_paths, [
			resolve('src/fs/fixtures/failme1'),
			resolve('src/fs/fixtures/failme2'),
		]);
	} else {
		throw Error('Expected to fail with unmapped_input_paths');
	}
});

test_find_modules('fail with input_directories_with_no_files', async () => {
	const result = await find_modules(
		fs,
		[
			resolve('src/fs/fixtures/baz1'),
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/bar2'),
			resolve('src/fs/fixtures/baz2'),
		],
		(id) => fs.find_files(id, ({path}) => !path.includes('.bar.')),
	);
	t.not.ok(result.ok);
	t.ok(result.reasons.length);
	if (result.type === 'input_directories_with_no_files') {
		t.equal(result.input_directories_with_no_files, [
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/bar2'),
		]);
	} else {
		throw Error('Expected to fail with input_directories_with_no_files');
	}
});

test_find_modules.run();
/* /test_find_modules */

/* test_load_modules */
const test_load_modules = suite('load_modules');

test_load_modules('fail with load_module_failures', async () => {
	const path_bar1 = resolve('src/fs/fixtures/bar1');
	const path_bar2 = resolve('src/fs/fixtures/bar2');
	const path_baz1 = resolve('src/fs/fixtures/baz1');
	const path_baz2 = resolve('src/fs/fixtures/baz2');
	const id_bar1 = join(path_bar1, 'test1.bar.ts');
	const id_bar2 = join(path_bar2, 'test2.bar.ts');
	const id_baz1 = join(path_baz1, 'test1.baz.ts');
	const id_baz2 = join(path_baz2, 'test2.baz.ts');
	const test_validation = ((mod: Record<string, any>) => mod.bar !== 1) as any;
	let error;
	const result = await load_modules(
		new Map([
			[path_bar1, [id_bar1, id_bar2]],
			[path_baz1, [id_baz1, id_baz2]],
		]),
		async (id) => {
			if (id === id_bar2) {
				return {
					ok: false,
					type: 'import_failed',
					id,
					error: (error = new Error('Test failed import')),
				};
			}
			return load_module(id, test_validation);
		},
	);
	t.not.ok(result.ok);
	t.ok(result.reasons.length);
	if (result.type !== 'load_module_failures') {
		throw Error('Expected to fail with load_module_failures');
	}
	t.is(result.load_module_failures.length, 2);
	const [failure1, failure2] = result.load_module_failures;
	if (failure1.type !== 'invalid') {
		throw Error('Expected to fail with invalid');
	}
	t.is(failure1.id, id_bar1);
	t.ok(failure1.mod);
	t.is(failure1.validation, test_validation.name);
	if (failure2.type !== 'import_failed') {
		throw Error('Expected to fail with import_failed');
	}
	t.is(failure2.id, id_bar2);
	t.is(failure2.error, error);
	t.is(result.modules.length, 2);
	t.is(result.modules[0].id, id_baz1);
	t.is(result.modules[0].mod, modTestBaz1);
	t.is(result.modules[1].id, id_baz2);
	t.is(result.modules[1].mod, modTestBaz2);
});

test_load_modules.run();
/* /test_load_modules */
