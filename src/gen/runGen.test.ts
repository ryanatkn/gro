import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'path';
import {Logger} from '@feltcoop/util/log.js';

import type {GenModuleMeta} from './genModule.js';
import {runGen} from './runGen.js';
import {fs} from '../fs/node.js';

const log = new Logger('test__gen'); // TODO test logger?

/* test__gen */
const test__gen = suite('gen');

test__gen('basic behavior', async () => {
	const sourceIdA = resolve('src/foo.gen.ts');
	const sourceIdBC = resolve('src/bar/bc');
	let fileA: undefined | {filename: string; content: string};
	let fileB: undefined | {filename: string; content: string};
	let fileC1: undefined | {filename: string; content: string};
	let fileC2: undefined | {filename: string; content: string};
	const modA: GenModuleMeta = {
		type: 'basic',
		id: sourceIdA,
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.originId, sourceIdA);
				if (fileA) throw Error('Already generated fileA');
				fileA = {
					filename: 'foo.ts',
					content: 'fileA',
				};
				return fileA.content; // here we return the shorthand version
			},
		},
	};
	const modB: GenModuleMeta = {
		type: 'basic',
		id: join(sourceIdBC, 'modB.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.originId, modB.id);
				if (fileB) throw Error('Already generated fileB');
				fileB = {
					filename: 'outputB.ts',
					content: 'fileB',
				};
				return fileB;
			},
		},
	};
	const modC: GenModuleMeta = {
		type: 'basic',
		id: join(sourceIdBC, 'modC.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.originId, modC.id);
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
	assert.is(genResults.inputCount, 3);
	assert.is(genResults.outputCount, 4);
	assert.is(genResults.successes.length, 3);
	assert.is(genResults.failures.length, 0);
	assert.is(genResults.results.length, 3);
	assert.is(genResults.results[0], genResults.successes[0]);
	assert.is(genResults.results[1], genResults.successes[1]);
	assert.is(genResults.results[2], genResults.successes[2]);

	const resultA = genResults.results[0];
	assert.ok(resultA?.ok);
	assert.ok(fileA);
	assert.equal(resultA.files, [
		{
			content: fileA.content,
			id: join(modA.id, '../', fileA.filename),
			originId: modA.id,
			format: true,
		},
	]);

	const resultB = genResults.results[1];
	assert.ok(resultB?.ok);
	assert.ok(fileB);
	assert.equal(resultB.files, [
		{
			content: `${fileB.content}/*FORMATTED*/`,
			id: join(modB.id, '../', fileB.filename),
			originId: modB.id,
			format: true,
		},
	]);
	const resultC = genResults.results[2];
	assert.ok(resultC?.ok);
	assert.ok(fileC1);
	assert.ok(fileC2);
	assert.equal(resultC.files, [
		{
			content: fileC1.content,
			id: join(modC.id, '../', fileC1.filename),
			originId: modC.id,
			format: true,
		},
		{
			content: fileC2.content,
			id: join(modC.id, '../', fileC2.filename),
			originId: modC.id,
			format: true,
		},
	]);
});

test__gen('failing gen function', async () => {
	const sourceIdA = resolve('src/foo.gen.ts');
	const sourceIdB = resolve('src/bar/baz');
	let fileB: undefined | {filename: string; content: string}; // no fileA because it's never generated
	let genError; // this error should be passed through to the result
	// This is the failing gen module.
	// It's ordered first to test that its failure doesn't cascade.
	const modA: GenModuleMeta = {
		type: 'basic',
		id: sourceIdA,
		mod: {
			gen: async () => {
				genError = Error('This fails for testing');
				throw genError;
			},
		},
	};
	const modB: GenModuleMeta = {
		type: 'basic',
		id: join(sourceIdB, 'modB.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.originId, modB.id);
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
	assert.is(genResults.inputCount, 2);
	assert.is(genResults.outputCount, 1);
	assert.is(genResults.successes.length, 1);
	assert.is(genResults.failures.length, 1);
	assert.is(genResults.results.length, 2);
	assert.is(genResults.results[0], genResults.failures[0]);
	assert.is(genResults.results[1], genResults.successes[0]);

	const resultA = genResults.results[0];
	assert.ok(resultA);
	assert.ok(!resultA?.ok);
	assert.ok(resultA.reason);
	assert.ok(resultA.error);

	const resultB = genResults.results[1];
	assert.ok(resultB?.ok);
	assert.ok(fileB);
	assert.equal(resultB.files, [
		{
			content: fileB.content,
			id: join(modB.id, '../', fileB.filename),
			originId: modB.id,
			format: true,
		},
	]);
});

test__gen.run();
/* test__gen */
