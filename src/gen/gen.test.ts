import {resolve, join} from 'path';

import {test, t} from '../oki/oki.js';
import {toGenResult, validateGenModule, GenModuleMeta, gen} from './gen.js';
import * as testGenHtml from './fixtures/testGenHtml.gen.html.js';
import * as testGenTs from './fixtures/testGenTs.gen.js';
import * as testGenMulti from './fixtures/testGenMulti.gen.js';
import * as testInvalidGenModule from './fixtures/testInvalidGenModule.js';

const originId = resolve('src/foo.gen.ts');

test('toGenResult', () => {
	test('plain string', () => {
		t.equal(toGenResult(originId, '/**/'), {
			originId,
			files: [{id: resolve('src/foo.ts'), contents: '/**/', originId}],
		});
	});
	test('object with a contents string', () => {
		t.equal(toGenResult(originId, {contents: '/**/'}), {
			originId,
			files: [{id: resolve('src/foo.ts'), contents: '/**/', originId}],
		});
	});
	test('fail with an unresolved id', () => {
		t.throws(() => toGenResult('src/foo.ts', {contents: '/**/'}));
	});
	test('fail with a build id', () => {
		t.throws(() => toGenResult(resolve('build/foo.js'), {contents: '/**/'}));
	});
	test('fail with an empty id', () => {
		t.throws(() => toGenResult('', {contents: '/**/'}));
	});
	test('custom file name', () => {
		t.equal(
			toGenResult(originId, {
				fileName: 'fooz.ts',
				contents: '/**/',
			}),
			{
				originId,
				files: [{id: resolve('src/fooz.ts'), contents: '/**/', originId}],
			},
		);
	});
	test('custom file name that matches the default file name', () => {
		t.equal(
			toGenResult(originId, {
				fileName: 'foo.ts',
				contents: '/**/',
			}),
			{
				originId,
				files: [{id: resolve('src/foo.ts'), contents: '/**/', originId}],
			},
		);
	});
	test('fail when custom file name explicitly matches the origin', () => {
		t.throws(() => {
			toGenResult(originId, {
				fileName: 'foo.gen.ts',
				contents: '/**/',
			});
		});
	});
	test('fail when file name implicitly matches the origin', () => {
		t.throws(() => {
			toGenResult(resolve('src/foo.ts'), {contents: '/**/'});
		});
	});
	test('fail with an empty file name', () => {
		t.throws(() => toGenResult(originId, {fileName: '', contents: '/**/'}));
	});
	test('additional file name parts', () => {
		t.equal(toGenResult(resolve('src/foo.bar.gen.ts'), {contents: '/**/'}), {
			originId: resolve('src/foo.bar.gen.ts'),
			files: [
				{
					id: resolve('src/foo.bar.ts'),
					contents: '/**/',
					originId: resolve('src/foo.bar.gen.ts'),
				},
			],
		});
	});
	test('js', () => {
		t.equal(
			toGenResult(originId, {
				fileName: 'foo.js',
				contents: '/**/',
			}),
			{
				originId,
				files: [{id: resolve('src/foo.js'), contents: '/**/', originId}],
			},
		);
	});
	test('implicit custom file extension', () => {
		t.equal(toGenResult(resolve('src/foo.gen.json.ts'), '[/**/]'), {
			originId: resolve('src/foo.gen.json.ts'),
			files: [
				{
					id: resolve('src/foo.json'),
					contents: '[/**/]',
					originId: resolve('src/foo.gen.json.ts'),
				},
			],
		});
	});
	test('implicit empty file extension', () => {
		t.equal(toGenResult(resolve('src/foo.gen..ts'), '[/**/]'), {
			originId: resolve('src/foo.gen..ts'),
			files: [
				{
					id: resolve('src/foo'),
					contents: '[/**/]',
					originId: resolve('src/foo.gen..ts'),
				},
			],
		});
	});
	test('implicit custom file extension with additional file name parts', () => {
		t.equal(
			toGenResult(resolve('src/foo.bar.gen.json.ts'), {contents: '[/**/]'}),
			{
				originId: resolve('src/foo.bar.gen.json.ts'),
				files: [
					{
						id: resolve('src/foo.bar.json'),
						contents: '[/**/]',
						originId: resolve('src/foo.bar.gen.json.ts'),
					},
				],
			},
		);
	});
	test('implicit custom file extension with many dots in between', () => {
		t.equal(toGenResult(resolve('src/foo...gen.ts'), '[/**/]'), {
			originId: resolve('src/foo...gen.ts'),
			files: [
				{
					id: resolve('src/foo...ts'),
					contents: '[/**/]',
					originId: resolve('src/foo...gen.ts'),
				},
			],
		});
	});
	test('fail with two parts following the .gen. pattern in the file name', () => {
		// This just ensures consistent file names - maybe loosen the restriction?
		// You can still implicitly name files like this,
		// but you have to move ".bar" before ".gen".
		t.throws(() => toGenResult(resolve('src/foo.gen.bar.json.ts'), '/**/'));
	});
	test('fail implicit file extension ending with a dot', () => {
		// This just ensures consistent file names - maybe loosen the restriction?
		// This one is more restrictive than the above,
		// because to have a file ending with a dot
		// you have to use an explicit file name.
		t.throws(() => toGenResult(resolve('src/foo.gen...ts'), '[/**/]'));
	});
	test('fail without a .gen. pattern in the file name', () => {
		t.throws(() => {
			toGenResult(resolve('src/foo.ts'), '/**/');
		});
	});
	test('fail without a .gen. pattern in a file name that has multiple other patterns', () => {
		t.throws(() => {
			toGenResult(resolve('src/foo.bar.baz.ts'), '/**/');
		});
	});
	test('fail with two .gen. patterns in the file name', () => {
		t.throws(() => toGenResult(resolve('src/gen.gen.ts'), '/**/'));
		t.throws(() => toGenResult(resolve('src/foo.gen.gen.ts'), '/**/'));
		t.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.ts'), '/**/'));
		t.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.baz.ts'), '/**/'));
	});
	test('explicit custom file extension', () => {
		t.equal(
			toGenResult(originId, {
				fileName: 'foo.json',
				contents: '[/**/]',
			}),
			{
				originId,
				files: [{id: resolve('src/foo.json'), contents: '[/**/]', originId}],
			},
		);
	});
	test('explicit custom empty file extension', () => {
		t.equal(
			toGenResult(originId, {
				fileName: 'foo',
				contents: '[/**/]',
			}),
			{
				originId,
				files: [{id: resolve('src/foo'), contents: '[/**/]', originId}],
			},
		);
	});
	test('explicit custom file extension ending with a dot', () => {
		t.equal(
			toGenResult(originId, {
				fileName: 'foo.',
				contents: '[/**/]',
			}),
			{
				originId,
				files: [{id: resolve('src/foo.'), contents: '[/**/]', originId}],
			},
		);
	});
	test('simple array of raw files', () => {
		t.equal(
			toGenResult(originId, [
				{contents: '/*1*/'},
				{fileName: 'foo2.ts', contents: '/*2*/'},
			]),
			{
				originId,
				files: [
					{id: resolve('src/foo.ts'), contents: '/*1*/', originId},
					{id: resolve('src/foo2.ts'), contents: '/*2*/', originId},
				],
			},
		);
	});
	test('complex array of raw files', () => {
		t.equal(
			toGenResult(originId, [
				{contents: '/*1*/'},
				{fileName: 'foo2.ts', contents: '/*2*/'},
				{fileName: 'foo3.ts', contents: '/*3*/'},
				{fileName: 'foo4.ts', contents: '/*4*/'},
				{fileName: 'foo5.json', contents: '[/*5*/]'},
			]),
			{
				originId,
				files: [
					{id: resolve('src/foo.ts'), contents: '/*1*/', originId},
					{id: resolve('src/foo2.ts'), contents: '/*2*/', originId},
					{id: resolve('src/foo3.ts'), contents: '/*3*/', originId},
					{id: resolve('src/foo4.ts'), contents: '/*4*/', originId},
					{id: resolve('src/foo5.json'), contents: '[/*5*/]', originId},
				],
			},
		);
	});
	test('fail with duplicate names because of omissions', () => {
		t.throws(() => {
			toGenResult(originId, [{contents: '/*1*/'}, {contents: '/*2*/'}]);
		});
	});
	test('fail with duplicate explicit names', () => {
		t.throws(() => {
			toGenResult(originId, [
				{fileName: 'foo.ts', contents: '/*1*/'},
				{fileName: 'foo.ts', contents: '/*2*/'},
			]);
		});
	});
	test('fail with duplicate explicit and implicit names', () => {
		t.throws(() => {
			toGenResult(originId, [
				{contents: '/*1*/'},
				{fileName: 'foo.ts', contents: '/*2*/'},
			]);
		});
	});
});

test('gen', async () => {
	test('basic behavior', async () => {
		const sourceIdA = resolve('src/foo.gen.ts');
		const sourceIdBC = resolve('src/bar/bc');
		let fileA: undefined | {fileName: string; contents: string};
		let fileB: undefined | {fileName: string; contents: string};
		let fileC1: undefined | {fileName: string; contents: string};
		let fileC2: undefined | {fileName: string; contents: string};
		let modA: GenModuleMeta = {
			id: sourceIdA,
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, sourceIdA);
					if (fileA) throw Error('Already generated fileA');
					fileA = {
						fileName: 'foo.ts',
						contents: 'fileA',
					};
					return fileA.contents; // here we return the shorthand version
				},
			},
		};
		let modB: GenModuleMeta = {
			id: join(sourceIdBC, 'modB.gen.ts'),
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, modB.id);
					if (fileB) throw Error('Already generated fileB');
					fileB = {
						fileName: 'outputB.ts',
						contents: 'fileB',
					};
					return fileB;
				},
			},
		};
		let modC: GenModuleMeta = {
			id: join(sourceIdBC, 'modC.gen.ts'),
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, modC.id);
					if (fileC1) throw Error('Already generated fileC1');
					if (fileC2) throw Error('Already generated fileC2');
					fileC1 = {
						fileName: 'outputC1.ts',
						contents: 'fileC1',
					};
					fileC2 = {
						fileName: 'outputC2.ts',
						contents: 'fileC2',
					};
					return [fileC1, fileC2];
				},
			},
		};
		const genModulesByInputPath = [modA, modB, modC];
		const genResults = await gen(genModulesByInputPath);
		t.is(genResults.inputCount, 3);
		t.is(genResults.outputCount, 4);
		t.is(genResults.successes.length, 3);
		t.is(genResults.failures.length, 0);
		t.is(genResults.results.length, 3);
		t.is(genResults.results[0], genResults.successes[0]);
		t.is(genResults.results[1], genResults.successes[1]);
		t.is(genResults.results[2], genResults.successes[2]);

		const resultA = genResults.results[0];
		t.ok(resultA?.ok);
		t.ok(fileA);
		t.equal(resultA.files, [
			{
				contents: fileA.contents,
				id: join(modA.id, '../', fileA.fileName),
				originId: modA.id,
			},
		]);

		const resultB = genResults.results[1];
		t.ok(resultB?.ok);
		t.ok(fileB);
		t.equal(resultB.files, [
			{
				contents: fileB.contents,
				id: join(modB.id, '../', fileB.fileName),
				originId: modB.id,
			},
		]);
		const resultC = genResults.results[2];
		t.ok(resultC?.ok);
		t.ok(fileC1);
		t.ok(fileC2);
		t.equal(resultC.files, [
			{
				contents: fileC1.contents,
				id: join(modC.id, '../', fileC1.fileName),
				originId: modC.id,
			},
			{
				contents: fileC2.contents,
				id: join(modC.id, '../', fileC2.fileName),
				originId: modC.id,
			},
		]);
	});

	test('failing gen function', async () => {
		const sourceIdA = resolve('src/foo.gen.ts');
		const sourceIdB = resolve('src/bar/baz');
		let fileB: undefined | {fileName: string; contents: string}; // no fileA because it's never generated
		let genError; // this error should be passed through to the result
		// This is the failing gen module.
		// It's ordered first to test that its failure doesn't cascade.
		let modA: GenModuleMeta = {
			id: sourceIdA,
			mod: {
				gen: async () => {
					genError = Error('This fails for testing');
					throw genError;
				},
			},
		};
		let modB: GenModuleMeta = {
			id: join(sourceIdB, 'modB.gen.ts'),
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, modB.id);
					if (fileB) throw Error('Already generated fileB');
					fileB = {
						fileName: 'outputB.ts',
						contents: 'fileB',
					};
					return fileB;
				},
			},
		};
		const genModulesByInputPath: GenModuleMeta[] = [modA, modB];
		const genResults = await gen(genModulesByInputPath);
		t.is(genResults.inputCount, 2);
		t.is(genResults.outputCount, 1);
		t.is(genResults.successes.length, 1);
		t.is(genResults.failures.length, 1);
		t.is(genResults.results.length, 2);
		t.is(genResults.results[0], genResults.failures[0]);
		t.is(genResults.results[1], genResults.successes[0]);

		const resultA = genResults.results[0];
		t.ok(resultA);
		t.ok(!resultA?.ok);
		t.ok(resultA.reason);
		t.ok(resultA.error);

		const resultB = genResults.results[1];
		t.ok(resultB?.ok);
		t.ok(fileB);
		t.equal(resultB.files, [
			{
				contents: fileB.contents,
				id: join(modB.id, '../', fileB.fileName),
				originId: modB.id,
			},
		]);
	});
});

test('validateGenModule()', () => {
	t.ok(validateGenModule(testGenHtml));
	t.ok(validateGenModule(testGenTs));
	t.ok(validateGenModule(testGenMulti));
	t.ok(!validateGenModule(testInvalidGenModule));
	t.ok(!validateGenModule({task: {run: {}}}));
});
