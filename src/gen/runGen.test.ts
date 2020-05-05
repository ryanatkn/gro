import {resolve, join} from 'path';

import {test, t} from '../oki/oki.js';
import {GenModuleMeta} from './genModule.js';
import {runGen} from './runGen.js';

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
		const genResults = await runGen(genModulesByInputPath);
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
		const genResults = await runGen(genModulesByInputPath);
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
