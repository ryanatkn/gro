import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';

import {find_modules, load_modules, load_module} from './modules.js';
import * as modTest1 from './fixtures/test1.foo.js';
import * as modTestBaz1 from './fixtures/baz1/test1.baz.js';
import * as modTestBaz2 from './fixtures/baz2/test2.baz.js';
import {get_possible_source_ids} from '../path/input_path.js';
import {find_files} from './find_files.js';

/* test__load_module */
const test__load_module = suite('load_module');

test__load_module('basic behavior', async () => {
	const id = resolve('src/lib/util/fixtures/test1.foo.js');
	let validatedMod;
	const result = await load_module(id, ((mod: any) => {
		validatedMod = mod;
		return true;
	}) as any);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.mod, validatedMod);
	assert.is(result.mod.mod, modTest1);
});

test__load_module('without validation', async () => {
	const id = resolve('src/lib/util/fixtures/test1.foo.js');
	const result = await load_module(id);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.mod, modTest1);
});

test__load_module('fails validation', async () => {
	const id = resolve('src/lib/util/fixtures/test1.foo.js');
	let validatedMod;
	const testValidation = (mod: Record<string, any>) => {
		validatedMod = mod;
		return false;
	};
	const result = await load_module(id, testValidation as any);
	assert.ok(!result.ok);
	if (result.type === 'invalid') {
		assert.is(result.validation, testValidation.name);
		assert.is(result.id, id);
		assert.is(result.mod, validatedMod);
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
	const path1 = resolve('src/lib/util/fixtures/test1');
	const id1 = resolve('src/lib/util/fixtures/test1.foo.ts');
	const id2 = resolve('src/lib/util/fixtures/test2.foo.ts');
	const result = await find_modules(
		[path1, id2],
		(id) => find_files(id),
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
	const id = resolve('src/lib/util/fixtures/');
	const result = await find_modules([id], (id) =>
		find_files(id, (path) => path.includes('.foo.'), undefined, true),
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
			resolve('src/lib/util/fixtures/bar1'),
			resolve('src/lib/util/fixtures/failme1'),
			resolve('src/lib/util/fixtures/bar2'),
			resolve('src/lib/util/fixtures/failme2'),
		],
		(id) => find_files(id),
		(input_path) => get_possible_source_ids(input_path, ['.foo.ts']),
	);
	assert.ok(!result.ok);
	assert.ok(result.reasons.length);
	if (result.type === 'unmapped_input_paths') {
		assert.equal(result.unmapped_input_paths, [
			resolve('src/lib/util/fixtures/failme1'),
			resolve('src/lib/util/fixtures/failme2'),
		]);
	} else {
		throw Error('Expected to fail with unmapped_input_paths');
	}
});

test__find_modules('fail with input_directories_with_no_files', async () => {
	const result = await find_modules(
		[
			resolve('src/lib/util/fixtures/baz1'),
			resolve('src/lib/util/fixtures/bar1'),
			resolve('src/lib/util/fixtures/bar2'),
			resolve('src/lib/util/fixtures/baz2'),
		],
		(id) => find_files(id, (path) => !path.includes('.bar.')),
	);
	assert.ok(!result.ok);
	assert.ok(result.reasons.length);
	if (result.type === 'input_directories_with_no_files') {
		assert.equal(result.input_directories_with_no_files, [
			resolve('src/lib/util/fixtures/bar1'),
			resolve('src/lib/util/fixtures/bar2'),
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
	const pathBar1 = resolve('src/lib/util/fixtures/bar1');
	const pathBar2 = resolve('src/lib/util/fixtures/bar2');
	const pathBaz1 = resolve('src/lib/util/fixtures/baz1');
	const pathBaz2 = resolve('src/lib/util/fixtures/baz2');
	const idBar1 = join(pathBar1, 'test1.bar.ts');
	const idBar2 = join(pathBar2, 'test2.bar.ts');
	const idBaz1 = join(pathBaz1, 'test1.baz.ts');
	const idBaz2 = join(pathBaz2, 'test2.baz.ts');
	const testValidation = ((mod: Record<string, any>) => mod.bar !== 1) as any;
	let error;
	const result = await load_modules(
		new Map([
			[pathBar1, [idBar1, idBar2]],
			[pathBaz1, [idBaz1, idBaz2]],
		]),
		true,
		async (id) => {
			if (id === idBar2) {
				return {
					ok: false,
					type: 'importFailed',
					id,
					error: (error = new Error('Test failed import')),
				};
			}
			return load_module(id, testValidation);
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
	assert.is(failure1.id, idBar1);
	assert.ok(failure1.mod);
	assert.is(failure1.validation, testValidation.name);
	if (failure2.type !== 'importFailed') {
		throw Error('Expected to fail with importFailed');
	}
	assert.is(failure2.id, idBar2);
	assert.is(failure2.error, error);
	assert.is(result.modules.length, 2);
	assert.is(result.modules[0].id, idBaz1);
	assert.is(result.modules[0].mod, modTestBaz1);
	assert.is(result.modules[1].id, idBaz2);
	assert.is(result.modules[1].mod, modTestBaz2);
});

test__load_modules.run();
/* test__load_modules */
