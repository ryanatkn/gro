import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';
import {Logger} from '@feltcoop/felt/util/log.js';

import type {GenModuleMeta} from 'src/gen/genModule.js';
import {runGen} from './runGen.js';
import {fs} from '../fs/node.js';

const log = new Logger('testGen'); // TODO test logger?

/* testGen */
const testGen = suite('gen');

testGen('basic behavior', async () => {
	const sourceIdA = resolve('src/foo.gen.ts');
	const sourceIdBC = resolve('src/bar/bc');
	let fileA: undefined | {filename: string; content: string};
	let fileB: undefined | {filename: string; content: string};
	let fileC1: undefined | {filename: string; content: string};
	let fileC2: undefined | {filename: string; content: string};
	let modA: GenModuleMeta = {
		id: sourceIdA,
		mod: {
			gen: async (ctx) => {
				t.is(ctx.originId, sourceIdA);
				if (fileA) throw Error('Already generated fileA');
				fileA = {
					filename: 'foo.ts',
					content: 'fileA',
				};
				return fileA.content; // here we return the shorthand version
			},
		},
	};
	let modB: GenModuleMeta = {
		id: join(sourceIdBC, 'modB.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.originId, modB.id);
				if (fileB) throw Error('Already generated fileB');
				fileB = {
					filename: 'outputB.ts',
					content: 'fileB',
				};
				return fileB;
			},
		},
	};
	let modC: GenModuleMeta = {
		id: join(sourceIdBC, 'modC.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.originId, modC.id);
				if (fileC1) throw Error('Already generated fileC1');
				if (fileC2) throw Error('Already generated fileC2');
				fileC1 = {
					filename: 'outputC1.ts',
					content: 'fileC1',
				};
				fileC2 = {
					filename: 'outputC2.ts',
					content: 'fileC2',
				};
				return [fileC1, fileC2];
			},
		},
	};
	const genModulesByInputPath = [modA, modB, modC];
	const genResults = await runGen(fs, genModulesByInputPath, log, async (_fs, id, content) =>
		id.endsWith('outputB.ts') ? `${content}/*FORMATTED*/` : content,
	);
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
			content: fileA.content,
			id: join(modA.id, '../', fileA.filename),
			originId: modA.id,
		},
	]);

	const resultB = genResults.results[1];
	t.ok(resultB?.ok);
	t.ok(fileB);
	t.equal(resultB.files, [
		{
			content: `${fileB.content}/*FORMATTED*/`,
			id: join(modB.id, '../', fileB.filename),
			originId: modB.id,
		},
	]);
	const resultC = genResults.results[2];
	t.ok(resultC?.ok);
	t.ok(fileC1);
	t.ok(fileC2);
	t.equal(resultC.files, [
		{
			content: fileC1.content,
			id: join(modC.id, '../', fileC1.filename),
			originId: modC.id,
		},
		{
			content: fileC2.content,
			id: join(modC.id, '../', fileC2.filename),
			originId: modC.id,
		},
	]);
});

testGen('failing gen function', async () => {
	const sourceIdA = resolve('src/foo.gen.ts');
	const sourceIdB = resolve('src/bar/baz');
	let fileB: undefined | {filename: string; content: string}; // no fileA because it's never generated
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
			gen: async (ctx) => {
				t.is(ctx.originId, modB.id);
				if (fileB) throw Error('Already generated fileB');
				fileB = {
					filename: 'outputB.ts',
					content: 'fileB',
				};
				return fileB;
			},
		},
	};
	const genModulesByInputPath: GenModuleMeta[] = [modA, modB];
	const genResults = await runGen(fs, genModulesByInputPath, log);
	t.is(genResults.inputCount, 2);
	t.is(genResults.outputCount, 1);
	t.is(genResults.successes.length, 1);
	t.is(genResults.failures.length, 1);
	t.is(genResults.results.length, 2);
	t.is(genResults.results[0], genResults.failures[0]);
	t.is(genResults.results[1], genResults.successes[0]);

	const resultA = genResults.results[0];
	t.ok(resultA);
	t.not.ok(resultA?.ok);
	t.ok(resultA.reason);
	t.ok(resultA.error);

	const resultB = genResults.results[1];
	t.ok(resultB?.ok);
	t.ok(fileB);
	t.equal(resultB.files, [
		{
			content: fileB.content,
			id: join(modB.id, '../', fileB.filename),
			originId: modB.id,
		},
	]);
});

testGen.run();
/* /testGen */
