import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import {findModules, loadModules, loadModule} from './modules.js';
import * as modTest1 from './fixtures/test1.foo.js';
import * as modTestBaz1 from './fixtures/baz1/test1.baz.js';
import * as modTestBaz2 from './fixtures/baz2/test2.baz.js';
import {findFiles} from './nodeFs.js';
import {getPossibleSourceIds} from './inputPath.js';
import type {Obj} from '../types.js';

/* test_loadModule */
const test_loadModule = suite('loadModule');

test_loadModule('basic behavior', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	let validatedMod;
	const result = await loadModule(id, ((mod: any) => {
		validatedMod = mod;
		return true;
	}) as any);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.mod, validatedMod);
	t.is(result.mod.mod, modTest1);
});

test_loadModule('without validation', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	const result = await loadModule(id);
	t.ok(result.ok);
	t.is(result.mod.id, id);
	t.is(result.mod.mod, modTest1);
});

test_loadModule('fails validation', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	let validatedMod;
	const testValidation = (mod: Obj) => {
		validatedMod = mod;
		return false;
	};
	const result = await loadModule(id, testValidation as any);
	t.not.ok(result.ok);
	if (result.type === 'invalid') {
		t.is(result.validation, testValidation.name);
		t.is(result.id, id);
		t.is(result.mod, validatedMod);
		t.is(result.mod, modTest1);
	} else {
		throw Error('Should be invalid');
	}
});

test_loadModule('fails to import', async () => {
	const id = resolve('foo/test/failure');
	const result = await loadModule(id);
	t.not.ok(result.ok);
	if (result.type === 'importFailed') {
		t.is(result.id, id);
		t.ok(result.error instanceof Error);
	} else {
		throw Error('Should fail to import');
	}
});

test_loadModule.run();
/* /test_loadModule */

/* test_findModules */
const test_findModules = suite('findModules');

test_findModules('with and without extension', async () => {
	const path1 = resolve('src/fs/fixtures/test1');
	const id1 = resolve('src/fs/fixtures/test1.foo.ts');
	const id2 = resolve('src/fs/fixtures/test2.foo.ts');
	const result = await findModules(
		[path1, id2],
		(id) => findFiles(id),
		(inputPath) => getPossibleSourceIds(inputPath, ['.foo.ts']),
	);
	t.ok(result.ok);
	t.equal(
		result.sourceIdsByInputPath,
		new Map([
			[path1, [id1]],
			[id2, [id2]],
		]),
	);
	t.equal(
		result.sourceIdPathDataByInputPath,
		new Map([
			[path1, {id: id1, isDirectory: false}],
			[id2, {id: id2, isDirectory: false}],
		]),
	);
});

test_findModules('directory', async () => {
	const id = resolve('src/fs/fixtures/');
	const result = await findModules([id], (id) => findFiles(id, ({path}) => path.includes('.foo.')));
	t.ok(result.ok);
	t.equal(
		result.sourceIdsByInputPath,
		new Map([[id, [join(id, 'test1.foo.ts'), join(id, 'test2.foo.ts')]]]),
	);
	t.equal(result.sourceIdPathDataByInputPath, new Map([[id, {id, isDirectory: true}]]));
});

test_findModules('fail with unmappedInputPaths', async () => {
	const result = await findModules(
		[
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/failme1'),
			resolve('src/fs/fixtures/bar2'),
			resolve('src/fs/fixtures/failme2'),
		],
		(id) => findFiles(id),
		(inputPath) => getPossibleSourceIds(inputPath, ['.foo.ts']),
	);
	t.not.ok(result.ok);
	t.ok(result.reasons.length);
	if (result.type === 'unmappedInputPaths') {
		t.equal(result.unmappedInputPaths, [
			resolve('src/fs/fixtures/failme1'),
			resolve('src/fs/fixtures/failme2'),
		]);
	} else {
		throw Error('Expected to fail with unmappedInputPaths');
	}
});

test_findModules('fail with inputDirectoriesWithNoFiles', async () => {
	const result = await findModules(
		[
			resolve('src/fs/fixtures/baz1'),
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/bar2'),
			resolve('src/fs/fixtures/baz2'),
		],
		(id) => findFiles(id, ({path}) => !path.includes('.bar.')),
	);
	t.not.ok(result.ok);
	t.ok(result.reasons.length);
	if (result.type === 'inputDirectoriesWithNoFiles') {
		t.equal(result.inputDirectoriesWithNoFiles, [
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/bar2'),
		]);
	} else {
		throw Error('Expected to fail with inputDirectoriesWithNoFiles');
	}
});

test_findModules.run();
/* /test_findModules */

/* test_loadModules */
const test_loadModules = suite('loadModules');

test_loadModules('fail with loadModuleFailures', async () => {
	const pathBar1 = resolve('src/fs/fixtures/bar1');
	const pathBar2 = resolve('src/fs/fixtures/bar2');
	const pathBaz1 = resolve('src/fs/fixtures/baz1');
	const pathBaz2 = resolve('src/fs/fixtures/baz2');
	const idBar1 = join(pathBar1, 'test1.bar.ts');
	const idBar2 = join(pathBar2, 'test2.bar.ts');
	const idBaz1 = join(pathBaz1, 'test1.baz.ts');
	const idBaz2 = join(pathBaz2, 'test2.baz.ts');
	const testValidation = ((mod: Obj) => mod.bar !== 1) as any;
	let error;
	const result = await loadModules(
		new Map([
			[pathBar1, [idBar1, idBar2]],
			[pathBaz1, [idBaz1, idBaz2]],
		]),
		async (id) => {
			if (id === idBar2) {
				return {
					ok: false,
					type: 'importFailed',
					id,
					error: (error = new Error('Test failed import')),
				};
			}
			return loadModule(id, testValidation);
		},
	);
	t.not.ok(result.ok);
	t.ok(result.reasons.length);
	if (result.type !== 'loadModuleFailures') {
		throw Error('Expected to fail with loadModuleFailures');
	}
	t.is(result.loadModuleFailures.length, 2);
	const [failure1, failure2] = result.loadModuleFailures;
	if (failure1.type !== 'invalid') {
		throw Error('Expected to fail with invalid');
	}
	t.is(failure1.id, idBar1);
	t.ok(failure1.mod);
	t.is(failure1.validation, testValidation.name);
	if (failure2.type !== 'importFailed') {
		throw Error('Expected to fail with importFailed');
	}
	t.is(failure2.id, idBar2);
	t.is(failure2.error, error);
	t.is(result.modules.length, 2);
	t.is(result.modules[0].id, idBaz1);
	t.is(result.modules[0].mod, modTestBaz1);
	t.is(result.modules[1].id, idBaz2);
	t.is(result.modules[1].mod, modTestBaz2);
});

test_loadModules.run();
/* /test_loadModules */
