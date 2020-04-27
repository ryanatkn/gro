import {resolve} from 'path';

import {test, t} from '../oki/oki.js';
import {loadModules, loadModule} from './loadModules.js';
import * as test1 from './fixtures/test1.foo.js';
import * as test2 from './fixtures/test2.foo.js';
import {findFiles} from './nodeFs.js';

test('loadModule()', async () => {
	test('basic behavior', async () => {
		const id = resolve('src/files/fixtures/test1.foo.js');
		let validatedMod;
		const result = await loadModule(id, ((mod: any) => {
			validatedMod = mod;
			return true;
		}) as any);
		t.ok(result.ok);
		t.is(result.mod.id, id);
		t.is(result.mod.mod, validatedMod);
		t.is(result.mod.mod, test1);
	});

	test('without validation', async () => {
		const id = resolve('src/files/fixtures/test1.foo.js');
		const result = await loadModule(id);
		t.ok(result.ok);
		t.is(result.mod.id, id);
		t.is(result.mod.mod, test1);
	});

	test('fails validation', async () => {
		const id = resolve('src/files/fixtures/test1.foo.js');
		let validatedMod;
		const testValidation = (mod: Obj) => {
			validatedMod = mod;
			return false;
		};
		const result = await loadModule(id, testValidation as any);
		t.ok(!result.ok);
		if (result.type === 'invalid') {
			t.is(result.validation, testValidation.name);
			t.is(result.id, id);
			t.is(result.mod, validatedMod);
			t.is(result.mod, test1);
		} else {
			throw new t.Error('Should be invalid');
		}
	});

	test('fails to import', async () => {
		const id = resolve('foo/test/failure');
		const result = await loadModule(id);
		t.ok(!result.ok);
		if (result.type === 'importFailed') {
			t.is(result.id, id);
			t.ok(result.error instanceof Error);
		} else {
			throw new t.Error('Should fail to import');
		}
	});
});

test('loadModules()', async () => {
	test('with and without extension', async () => {
		const result = await loadModules(
			[
				resolve('src/files/fixtures/test1'),
				resolve('src/files/fixtures/test2.foo.ts'),
			],
			['.foo.ts'],
			id => findFiles(id),
			loadModule,
		);
		t.ok(result.ok);
		t.is(result.modules.length, 2);
		t.is(result.modules[0].mod, test1);
		t.is(result.modules[1].mod, test2);
	});

	test('directory', async () => {
		const result = await loadModules(
			[resolve('src/files/fixtures/')],
			[],
			id => findFiles(id, ({path}) => path.includes('.foo.')),
			loadModule,
		);
		t.ok(result.ok);
		t.is(result.modules.length, 2);
		result.modules.sort((a, b) => (a.id > b.id ? 1 : -1)); // TODO should the API ensure sort order?
		t.is(result.modules[0].mod, test1);
		t.is(result.modules[1].mod, test2);
	});

	test('duplicates', async () => {
		const result = await loadModules(
			[
				resolve('src/files/fixtures/test1'),
				resolve('src/files/fixtures/test1'),
				resolve('src/files/fixtures/test1.foo.ts'),
				resolve('src/files/fixtures/test2.foo.ts'),
				resolve('src/files/fixtures/test2.foo.ts'),
				resolve('src/files/fixtures/test2.foo.ts'),
				resolve('src/files/fixtures'),
			],
			['.foo.ts'],
			id => findFiles(id, ({path}) => path.includes('.foo.')),
			loadModule,
		);
		t.ok(result.ok);
		t.is(result.modules.length, 2);
	});

	test('fail with unmappedInputPaths', async () => {
		const result = await loadModules(
			[
				resolve('src/files/fixtures/bar1'),
				resolve('src/files/fixtures/failme1'),
				resolve('src/files/fixtures/bar2'),
				resolve('src/files/fixtures/failme2'),
			],
			['.foo.ts'],
			id => findFiles(id),
			loadModule,
		);
		t.ok(!result.ok);
		t.ok(result.reasons.length);
		if (result.type === 'unmappedInputPaths') {
			t.equal(result.unmappedInputPaths, [
				resolve('src/files/fixtures/failme1'),
				resolve('src/files/fixtures/failme2'),
			]);
		} else {
			throw new t.Error('Expected to fail with unmappedInputPaths');
		}
	});

	test('fail with inputDirectoriesWithNoFiles', async () => {
		const result = await loadModules(
			[
				resolve('src/files/fixtures/baz1'),
				resolve('src/files/fixtures/bar1'),
				resolve('src/files/fixtures/bar2'),
				resolve('src/files/fixtures/baz2'),
			],
			[],
			id => findFiles(id, ({path}) => !path.includes('.bar.')),
			loadModule,
		);
		t.ok(!result.ok);
		t.ok(result.reasons.length);
		if (result.type === 'inputDirectoriesWithNoFiles') {
			t.equal(result.inputDirectoriesWithNoFiles, [
				resolve('src/files/fixtures/bar1'),
				resolve('src/files/fixtures/bar2'),
			]);
		} else {
			throw new t.Error('Expected to fail with inputDirectoriesWithNoFiles');
		}
	});

	test('fail with loadModuleFailures', async () => {
		const testValidation = ((mod: Obj) => mod.bar !== 1) as any;
		let error;
		const result = await loadModules(
			[
				resolve('src/files/fixtures/baz1'),
				resolve('src/files/fixtures/bar1'),
				resolve('src/files/fixtures/bar2'),
				resolve('src/files/fixtures/baz2'),
			],
			[],
			id => findFiles(id),
			async id => {
				if (id.endsWith('test2.bar.ts')) {
					return {
						ok: false,
						type: 'importFailed',
						id,
						error: error = new Error('Test failed import'),
					};
				}
				return loadModule(id, testValidation);
			},
		);
		t.ok(!result.ok);
		t.ok(result.reasons.length);
		if (result.type === 'loadModuleFailures') {
			t.is(result.loadModuleFailures.length, 2);
			const [failure1, failure2] = result.loadModuleFailures;
			if (failure1.type === 'invalid') {
				t.is(failure1.id, resolve('src/files/fixtures/bar1/test1.bar.ts'));
				t.ok(failure1.mod);
				t.is(failure1.validation, testValidation.name);
			} else {
				throw new t.Error('Expected to fail with invalid');
			}
			if (failure2.type === 'importFailed') {
				t.is(failure2.id, resolve('src/files/fixtures/bar2/test2.bar.ts'));
				t.is(failure2.error, error);
			} else {
				throw new t.Error('Expected to fail with importFailed');
			}
		} else {
			throw new t.Error('Expected to fail with loadModuleFailures');
		}
	});
});
