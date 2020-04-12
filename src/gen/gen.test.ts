import {resolve, join} from 'path';

import {test, t} from '../oki/oki.js';
import {
	toGenResult,
	validateGenModule,
	gen,
	GenFile,
	GenModuleMeta,
	RawGenFile,
} from './gen.js';
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
		const dir = resolve('src/foo/bar');
		const sourceIdA = join(dir, 'bazA.gen.ts');
		const sourceIdB = join(dir, 'baz/B.gen.ts');
		let fileA: undefined | RawGenFile;
		let fileB1: undefined | RawGenFile;
		let fileB2: undefined | RawGenFile;
		let outputA: undefined | GenFile;
		let outputB1: undefined | GenFile;
		let outputB2: undefined | GenFile;
		let modA: GenModuleMeta = {
			id: sourceIdA,
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, sourceIdA);
					if (fileA) throw Error('Already generated fileA');
					fileA = {
						fileName: 'bazA.ts',
						contents: 'fileA',
					};
					return fileA.contents; // here we return the shorthand version
				},
			},
		};
		let modB: GenModuleMeta = {
			id: sourceIdB,
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, sourceIdB);
					if (fileB1) throw Error('Already generated fileB1');
					if (fileB2) throw Error('Already generated fileB2');
					fileB1 = {
						fileName: 'outputB1.ts',
						contents: 'fileB1',
					};
					fileB2 = {
						fileName: 'outputB2.ts',
						contents: 'fileB2',
					};
					return [fileB1, fileB2];
				},
			},
		};
		const results = await gen({
			dir,
			logLevel: 0,
			host: {
				findGenModules: async dir2 => {
					t.is(dir, dir2);
					return [sourceIdA, sourceIdB];
				},
				loadGenModule: async sourceId => {
					if (sourceId === sourceIdA) {
						return modA;
					} else if (sourceId === sourceIdB) {
						return modB;
					} else {
						throw Error(`Unknown sourceId ${sourceId}`);
					}
				},
				outputFile: async file => {
					if (file.originId === sourceIdA) {
						outputA = file;
					} else if (file.id.includes('B1')) {
						outputB1 = file;
					} else {
						outputB2 = file;
					}
				},
			},
		});
		t.ok(results.ok);
		t.is(results.count, 3);
		t.is(results.results.length, 2);
		t.ok(fileA);
		t.ok(outputA);
		t.is(fileA.contents, outputA.contents);
		t.ok(outputA.id.endsWith(fileA.fileName!));
		t.equal(outputA, {
			id: join(dir, 'bazA.ts'),
			originId: sourceIdA,
			contents: 'fileA',
		});
		t.ok(fileB1);
		t.ok(outputB1);
		t.is(fileB1.contents, outputB1.contents);
		t.ok(outputB1.id.endsWith(fileB1.fileName!));
		t.equal(outputB1, {
			id: join(dir, 'baz/outputB1.ts'),
			originId: sourceIdB,
			contents: 'fileB1',
		});
		t.ok(fileB2);
		t.ok(outputB2);
		t.is(fileB2.contents, outputB2.contents);
		t.ok(outputB2.id.endsWith(fileB2.fileName!));
		t.equal(outputB2, {
			id: join(dir, 'baz/outputB2.ts'),
			originId: sourceIdB,
			contents: 'fileB2',
		});
	});

	test('invalid gen module', async () => {
		const dir = resolve('src/foo/bar');
		const sourceIdA = join(dir, 'baz/A.gen.ts');
		const sourceIdB = join(dir, 'bazB.gen.ts');
		let fileB: undefined | RawGenFile; // no fileA b/c it should never be generated
		let outputA: undefined | GenFile;
		let outputB: undefined | GenFile;
		// This is the invalid gen module.
		// It's ordered first to test that its failure doesn't cascade.
		let modA: GenModuleMeta = {
			id: sourceIdA,
			mod: {
				gen: {
					gen: async () => {
						throw Error('Should not be called');
					},
				} as any,
			},
		};
		let modB: GenModuleMeta = {
			id: sourceIdB,
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, sourceIdB);
					if (fileB) throw Error('Already generated fileB');
					fileB = {
						fileName: 'bazB.ts',
						contents: 'fileB',
					};
					return fileB;
				},
			},
		};
		const results = await gen({
			dir,
			logLevel: 0,
			host: {
				findGenModules: async dir2 => {
					t.is(dir, dir2);
					return [sourceIdA, sourceIdB];
				},
				loadGenModule: async sourceId => {
					if (sourceId === sourceIdA) {
						return modA;
					} else if (sourceId === sourceIdB) {
						return modB;
					} else {
						throw Error(`Unknown sourceId ${sourceId}`);
					}
				},
				outputFile: async file => {
					if (file.originId === sourceIdA) {
						outputA = file;
					} else {
						outputB = file;
					}
				},
			},
		});
		t.notOk(results.ok);
		t.is(results.count, 1);
		t.is(results.results.length, 2);
		t.notOk(results.results[0].ok);
		t.ok(results.results[1].ok);
		t.is(outputA, undefined);
		t.ok(fileB);
		t.ok(outputB);
		t.is(fileB.contents, outputB.contents);
		t.ok(outputB.id.endsWith(fileB.fileName!));
		t.equal(outputB, {
			id: join(dir, 'bazB.ts'),
			originId: sourceIdB,
			contents: 'fileB',
		});
	});

	test('failing gen function', async () => {
		const dir = resolve('src/foo/bar');
		const sourceIdA = join(dir, 'baz/A.gen.ts');
		const sourceIdB = join(dir, 'bazB.gen.ts');
		let fileB: undefined | RawGenFile; // no fileA because it's never generated
		let outputA: undefined | GenFile;
		let outputB: undefined | GenFile;
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
			id: sourceIdB,
			mod: {
				gen: async ctx => {
					t.is(ctx.originId, sourceIdB);
					if (fileB) throw Error('Already generated fileB');
					fileB = {
						fileName: 'bazB.ts',
						contents: 'fileB',
					};
					return fileB;
				},
			},
		};

		const results = await gen({
			dir,
			logLevel: 0,
			host: {
				findGenModules: async dir2 => {
					t.is(dir, dir2);
					return [sourceIdA, sourceIdB];
				},
				loadGenModule: async sourceId => {
					if (sourceId === sourceIdA) {
						return modA;
					} else if (sourceId === sourceIdB) {
						return modB;
					} else {
						throw Error(`Unknown sourceId ${sourceId}`);
					}
				},
				outputFile: async file => {
					if (file.originId === sourceIdA) {
						outputA = file;
					} else {
						outputB = file;
					}
				},
			},
		});

		t.notOk(results.ok);
		t.is(results.count, 1);
		t.is(results.results.length, 2);
		t.ok(!results.results[0].ok); // TODO why does `notOk` assert fail to get inference here?
		t.is(results.results[0].error, genError);
		t.ok(results.results[1].ok);
		t.is(outputA, undefined);
		t.ok(fileB);
		t.ok(outputB);
		t.is(fileB.contents, outputB.contents);
		t.ok(outputB.id.endsWith(fileB.fileName!));
		t.equal(outputB, {
			id: join(dir, 'bazB.ts'),
			originId: sourceIdB,
			contents: 'fileB',
		});
	});
});

test('validateGenModule()', () => {
	t.ok(validateGenModule(testGenHtml));
	t.ok(validateGenModule(testGenTs));
	t.ok(validateGenModule(testGenMulti));
	t.notOk(validateGenModule(testInvalidGenModule));
	t.notOk(validateGenModule({task: {run: {}}}));
});
