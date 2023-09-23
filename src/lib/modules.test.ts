import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';

import {find_modules, load_modules, load_module} from './modules.js';
import * as modTest1 from '$fixtures/test1.foo.js';
import * as modTestBaz1 from '$fixtures/baz1/test1.baz.js';
import * as modTestBaz2 from '$fixtures/baz2/test2.baz.js';
import {get_possible_source_ids} from './input_path.js';
import {search_fs} from './search_fs.js';

/* test__load_module */
const test__load_module = suite('load_module');

test__load_module('basic behavior', async () => {
	const id = resolve('src/fixtures/test1.foo.js');
	let validated_mod;
	const result = await load_module(id, ((mod: any) => {
		validated_mod = mod;
		return true;
	}) as any);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.mod, validated_mod);
	assert.is(result.mod.mod, modTest1);
});

test__load_module('without validation', async () => {
	const id = resolve('src/fixtures/test1.foo.js');
	const result = await load_module(id);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.mod, modTest1);
});

test__load_module('fails validation', async () => {
	const id = resolve('src/fixtures/test1.foo.js');
	let validated_mod;
	const test_validation = (mod: Record<string, any>) => {
		validated_mod = mod;
		return false;
	};
	const result = await load_module(id, test_validation as any);
	assert.ok(!result.ok);
	if (result.type === 'invalid') {
		assert.is(result.validation, test_validation.name);
		assert.is(result.id, id);
		assert.is(result.mod, validated_mod);
		assert.is(result.mod, modTest1);
	} else {
		throw Error('Should be invalid');
	}
});

test__load_module('fails to import', async () => {
	const id = resolve('foo/test/failure');
	const result = await load_module(id);
	assert.ok(!result.ok);
	if (result.type === 'importFailed') {
		assert.is(result.id, id);
		assert.ok(result.error instanceof Error);
	} else {
		throw Error('Should fail to import');
	}
});

test__load_module.run();
/* test__load_module */

/* test__find_modules */
const test__find_modules = suite('find_modules');

test__find_modules('with and without extension', async () => {
	const path1 = resolve('src/fixtures/test1');
	const id1 = resolve('src/fixtures/test1.foo.ts');
	const id2 = resolve('src/fixtures/test2.foo.ts');
	const result = await find_modules(
		[path1, id2],
		(id) => search_fs(id, {files_only: false}),
		(input_path) => get_possible_source_ids(input_path, ['.foo.ts']),
	);
	assert.ok(result.ok);
	assert.equal(
		result.source_ids_by_input_path,
		new Map([
			[path1, [id1]],
			[id2, [id2]],
		]),
	);
	assert.equal(
		result.source_id_path_data_by_input_path,
		new Map([
			[path1, {id: id1, isDirectory: false}],
			[id2, {id: id2, isDirectory: false}],
		]),
	);
});

test__find_modules('directory', async () => {
	const id = resolve('src/fixtures/');
	const result = await find_modules([id], (id) =>
		search_fs(id, {filter: (path) => path.includes('.foo.')}),
	);
	assert.ok(result.ok);
	assert.equal(
		result.source_ids_by_input_path,
		new Map([[id, [join(id, 'test1.foo.ts'), join(id, 'test2.foo.ts')]]]),
	);
	assert.equal(result.source_id_path_data_by_input_path, new Map([[id, {id, isDirectory: true}]]));
});

test__find_modules('fail with unmapped_input_paths', async () => {
	const result = await find_modules(
		[
			resolve('src/fixtures/bar1'),
			resolve('src/fixtures/failme1'),
			resolve('src/fixtures/bar2'),
			resolve('src/fixtures/failme2'),
		],
		(id) => search_fs(id, {files_only: false}),
		(input_path) => get_possible_source_ids(input_path, ['.foo.ts']),
	);
	assert.ok(!result.ok);
	assert.ok(result.reasons.length);
	if (result.type === 'unmapped_input_paths') {
		assert.equal(result.unmapped_input_paths, [
			resolve('src/fixtures/failme1'),
			resolve('src/fixtures/failme2'),
		]);
	} else {
		throw Error('Expected to fail with unmapped_input_paths');
	}
});

test__find_modules('fail with input_directories_with_no_files', async () => {
	const result = await find_modules(
		[
			resolve('src/fixtures/baz1'),
			resolve('src/fixtures/bar1'),
			resolve('src/fixtures/bar2'),
			resolve('src/fixtures/baz2'),
		],
		(id) => search_fs(id, {filter: (path) => !path.includes('.bar.'), files_only: false}),
	);
	assert.ok(!result.ok);
	assert.ok(result.reasons.length);
	if (result.type === 'input_directories_with_no_files') {
		assert.equal(result.input_directories_with_no_files, [
			resolve('src/fixtures/bar1'),
			resolve('src/fixtures/bar2'),
		]);
	} else {
		throw Error('Expected to fail with input_directories_with_no_files');
	}
});

test__find_modules.run();
/* test__find_modules */

/* test__load_modules */
const test__load_modules = suite('load_modules');

test__load_modules('fail with load_module_failures', async () => {
	const path_bar1 = resolve('src/fixtures/bar1');
	const path_bar2 = resolve('src/fixtures/bar2');
	const path_baz1 = resolve('src/fixtures/baz1');
	const path_baz2 = resolve('src/fixtures/baz2');
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
					type: 'importFailed',
					id,
					error: (error = new Error('Test failed import')),
				};
			}
			return load_module(id, test_validation);
		},
	);
	assert.ok(!result.ok);
	assert.ok(result.reasons.length);
	if (result.type !== 'load_module_failures') {
		throw Error('Expected to fail with load_module_failures');
	}
	assert.is(result.load_module_failures.length, 2);
	const [failure1, failure2] = result.load_module_failures;
	if (failure1.type !== 'invalid') {
		throw Error('Expected to fail with invalid');
	}
	assert.is(failure1.id, id_bar1);
	assert.ok(failure1.mod);
	assert.is(failure1.validation, test_validation.name);
	if (failure2.type !== 'importFailed') {
		throw Error('Expected to fail with importFailed');
	}
	assert.is(failure2.id, id_bar2);
	assert.is(failure2.error, error);
	assert.is(result.modules.length, 2);
	assert.is(result.modules[0].id, id_baz1);
	assert.is(result.modules[0].mod, modTestBaz1);
	assert.is(result.modules[1].id, id_baz2);
	assert.is(result.modules[1].mod, modTestBaz2);
});

test__load_modules.run();
/* test__load_modules */
