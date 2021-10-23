import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'path';

import {findModules, loadModules, loadModule} from './modules.js';
import * as modTest1 from './fixtures/test1.foo.js';
import * as modTestBaz1 from './fixtures/baz1/test1.baz.js';
import * as modTestBaz2 from './fixtures/baz2/test2.baz.js';
import {fs} from './node.js';
import {getPossibleSourceIds} from './inputPath.js';

/* testLoadModule */
const testLoadModule = suite('loadModule');

testLoadModule('basic behavior', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	let validatedMod;
	const result = await loadModule(id, true, ((mod: any) => {
		validatedMod = mod;
		return true;
	}) as any);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.mod, validatedMod);
	assert.is(result.mod.mod, modTest1);
});

testLoadModule('without validation', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	const result = await loadModule(id, true);
	assert.ok(result.ok);
	assert.is(result.mod.id, id);
	assert.is(result.mod.mod, modTest1);
});

testLoadModule('fails validation', async () => {
	const id = resolve('src/fs/fixtures/test1.foo.js');
	let validatedMod;
	const testValidation = (mod: Record<string, any>) => {
		validatedMod = mod;
		return false;
	};
	const result = await loadModule(id, true, testValidation as any);
	assert.not.ok(result.ok);
	if (result.type === 'invalid') {
		assert.is(result.validation, testValidation.name);
		assert.is(result.id, id);
		assert.is(result.mod, validatedMod);
		assert.is(result.mod, modTest1);
	} else {
		throw Error('Should be invalid');
	}
});

testLoadModule('fails to import', async () => {
	const id = resolve('foo/test/failure');
	const result = await loadModule(id, true);
	assert.not.ok(result.ok);
	if (result.type === 'importFailed') {
		assert.is(result.id, id);
		assert.ok(result.error instanceof Error);
	} else {
		throw Error('Should fail to import');
	}
});

testLoadModule.run();
/* /testLoadModule */

/* testFindModules */
const testFindModules = suite('findModules');

testFindModules('with and without extension', async () => {
	const path1 = resolve('src/fs/fixtures/test1');
	const id1 = resolve('src/fs/fixtures/test1.foo.ts');
	const id2 = resolve('src/fs/fixtures/test2.foo.ts');
	const result = await findModules(
		fs,
		[path1, id2],
		(id) => fs.findFiles(id),
		(inputPath) => getPossibleSourceIds(inputPath, ['.foo.ts']),
	);
	assert.ok(result.ok);
	assert.equal(
		result.sourceIdsByInputPath,
		new Map([
			[path1, [id1]],
			[id2, [id2]],
		]),
	);
	assert.equal(
		result.sourceIdPathDataByInputPath,
		new Map([
			[path1, {id: id1, isDirectory: false}],
			[id2, {id: id2, isDirectory: false}],
		]),
	);
});

testFindModules('directory', async () => {
	const id = resolve('src/fs/fixtures/');
	const result = await findModules(fs, [id], (id) =>
		fs.findFiles(id, ({path}) => path.includes('.foo.')),
	);
	assert.ok(result.ok);
	assert.equal(
		result.sourceIdsByInputPath,
		new Map([[id, [join(id, 'test1.foo.ts'), join(id, 'test2.foo.ts')]]]),
	);
	assert.equal(result.sourceIdPathDataByInputPath, new Map([[id, {id, isDirectory: true}]]));
});

testFindModules('fail with unmappedInputPaths', async () => {
	const result = await findModules(
		fs,
		[
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/failme1'),
			resolve('src/fs/fixtures/bar2'),
			resolve('src/fs/fixtures/failme2'),
		],
		(id) => fs.findFiles(id),
		(inputPath) => getPossibleSourceIds(inputPath, ['.foo.ts']),
	);
	assert.not.ok(result.ok);
	assert.ok(result.reasons.length);
	if (result.type === 'unmappedInputPaths') {
		assert.equal(result.unmappedInputPaths, [
			resolve('src/fs/fixtures/failme1'),
			resolve('src/fs/fixtures/failme2'),
		]);
	} else {
		throw Error('Expected to fail with unmappedInputPaths');
	}
});

testFindModules('fail with inputDirectoriesWithNoFiles', async () => {
	const result = await findModules(
		fs,
		[
			resolve('src/fs/fixtures/baz1'),
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/bar2'),
			resolve('src/fs/fixtures/baz2'),
		],
		(id) => fs.findFiles(id, ({path}) => !path.includes('.bar.')),
	);
	assert.not.ok(result.ok);
	assert.ok(result.reasons.length);
	if (result.type === 'inputDirectoriesWithNoFiles') {
		assert.equal(result.inputDirectoriesWithNoFiles, [
			resolve('src/fs/fixtures/bar1'),
			resolve('src/fs/fixtures/bar2'),
		]);
	} else {
		throw Error('Expected to fail with inputDirectoriesWithNoFiles');
	}
});

testFindModules.run();
/* /testFindModules */

/* testLoadModules */
const testLoadModules = suite('loadModules');

testLoadModules('fail with loadModuleFailures', async () => {
	const pathBar1 = resolve('src/fs/fixtures/bar1');
	const pathBar2 = resolve('src/fs/fixtures/bar2');
	const pathBaz1 = resolve('src/fs/fixtures/baz1');
	const pathBaz2 = resolve('src/fs/fixtures/baz2');
	const idBar1 = join(pathBar1, 'test1.bar.ts');
	const idBar2 = join(pathBar2, 'test2.bar.ts');
	const idBaz1 = join(pathBaz1, 'test1.baz.ts');
	const idBaz2 = join(pathBaz2, 'test2.baz.ts');
	const testValidation = ((mod: Record<string, any>) => mod.bar !== 1) as any;
	let error;
	const result = await loadModules(
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
			return loadModule(id, true, testValidation);
		},
	);
	assert.not.ok(result.ok);
	assert.ok(result.reasons.length);
	if (result.type !== 'loadModuleFailures') {
		throw Error('Expected to fail with loadModuleFailures');
	}
	assert.is(result.loadModuleFailures.length, 2);
	const [failure1, failure2] = result.loadModuleFailures;
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

testLoadModules.run();
/* /testLoadModules */
