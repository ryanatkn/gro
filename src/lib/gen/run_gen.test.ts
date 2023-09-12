import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';
import {Logger} from '@feltjs/util/log.js';
import {Timings} from '@feltjs/util/timings.js';

import type {GenModuleMeta} from './gen_module.js';
import {run_gen} from './run_gen.js';

const log = new Logger('test__gen'); // TODO test logger?

/* test__gen */
const test__gen = suite('gen');

test__gen('basic behavior', async () => {
	const source_idA = resolve('src/foo.gen.ts');
	const source_idBC = resolve('src/bar/bc');
	let fileA: undefined | {filename: string; content: string};
	let fileB: undefined | {filename: string; content: string};
	let fileC1: undefined | {filename: string; content: string};
	let fileC2: undefined | {filename: string; content: string};
	const modA: GenModuleMeta = {
		type: 'basic',
		id: source_idA,
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, source_idA);
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
		id: join(source_idBC, 'modB.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, modB.id);
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
		id: join(source_idBC, 'modC.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, modC.id);
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
	const gen_modulesByInputPath = [modA, modB, modC];
	const gen_results = await run_gen(
		gen_modulesByInputPath,
		log,
		new Timings(),
		async (id, content) => (id.endsWith('outputB.ts') ? `${content}/*FORMATTED*/` : content),
	);
	assert.is(gen_results.input_count, 3);
	assert.is(gen_results.output_count, 4);
	assert.is(gen_results.successes.length, 3);
	assert.is(gen_results.failures.length, 0);
	assert.is(gen_results.results.length, 3);
	assert.is(gen_results.results[0], gen_results.successes[0]);
	assert.is(gen_results.results[1], gen_results.successes[1]);
	assert.is(gen_results.results[2], gen_results.successes[2]);

	const resultA = gen_results.results[0];
	assert.ok(resultA?.ok);
	assert.ok(fileA);
	assert.equal(resultA.files, [
		{
			content: fileA.content,
			id: join(modA.id, '../', fileA.filename),
			origin_id: modA.id,
			format: true,
		},
	]);

	const resultB = gen_results.results[1];
	assert.ok(resultB?.ok);
	assert.ok(fileB);
	assert.equal(resultB.files, [
		{
			content: `${fileB.content}/*FORMATTED*/`,
			id: join(modB.id, '../', fileB.filename),
			origin_id: modB.id,
			format: true,
		},
	]);
	const resultC = gen_results.results[2];
	assert.ok(resultC?.ok);
	assert.ok(fileC1);
	assert.ok(fileC2);
	assert.equal(resultC.files, [
		{
			content: fileC1.content,
			id: join(modC.id, '../', fileC1.filename),
			origin_id: modC.id,
			format: true,
		},
		{
			content: fileC2.content,
			id: join(modC.id, '../', fileC2.filename),
			origin_id: modC.id,
			format: true,
		},
	]);
});

test__gen('failing gen function', async () => {
	const source_idA = resolve('src/foo.gen.ts');
	const source_idB = resolve('src/bar/baz');
	let fileB: undefined | {filename: string; content: string}; // no fileA because it's never generated
	let genError; // this error should be passed through to the result
	// This is the failing gen module.
	// It's ordered first to test that its failure doesn't cascade.
	const modA: GenModuleMeta = {
		type: 'basic',
		id: source_idA,
		mod: {
			gen: async () => {
				genError = Error('This fails for testing');
				throw genError;
			},
		},
	};
	const modB: GenModuleMeta = {
		type: 'basic',
		id: join(source_idB, 'modB.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, modB.id);
				if (fileB) throw Error('Already generated fileB');
				fileB = {
					filename: 'outputB.ts',
					content: 'fileB',
				};
				return fileB;
			},
		},
	};
	const gen_modulesByInputPath: GenModuleMeta[] = [modA, modB];
	const gen_results = await run_gen(gen_modulesByInputPath, log, new Timings());
	assert.is(gen_results.input_count, 2);
	assert.is(gen_results.output_count, 1);
	assert.is(gen_results.successes.length, 1);
	assert.is(gen_results.failures.length, 1);
	assert.is(gen_results.results.length, 2);
	assert.is(gen_results.results[0], gen_results.failures[0]);
	assert.is(gen_results.results[1], gen_results.successes[0]);

	const resultA = gen_results.results[0];
	assert.ok(resultA);
	assert.ok(!resultA?.ok);
	assert.ok(resultA.reason);
	assert.ok(resultA.error);

	const resultB = gen_results.results[1];
	assert.ok(resultB?.ok);
	assert.ok(fileB);
	assert.equal(resultB.files, [
		{
			content: fileB.content,
			id: join(modB.id, '../', fileB.filename),
			origin_id: modB.id,
			format: true,
		},
	]);
});

test__gen.run();
/* test__gen */
