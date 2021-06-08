import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import type {Gen_Module_Meta} from './gen_module.js';
import {run_gen} from './run_gen.js';
import {fs} from '../fs/node.js';

/* test_gen */
const test_gen = suite('gen');

test_gen('basic behavior', async () => {
	const source_idA = resolve('src/foo.gen.ts');
	const source_idBC = resolve('src/bar/bc');
	let file_a: undefined | {filename: string; contents: string};
	let file_b: undefined | {filename: string; contents: string};
	let file_c1: undefined | {filename: string; contents: string};
	let file_c2: undefined | {filename: string; contents: string};
	let modA: Gen_Module_Meta = {
		id: source_idA,
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, source_idA);
				if (file_a) throw Error('Already generated file_a');
				file_a = {
					filename: 'foo.ts',
					contents: 'file_a',
				};
				return file_a.contents; // here we return the shorthand version
			},
		},
	};
	let modB: Gen_Module_Meta = {
		id: join(source_idBC, 'modB.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, modB.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'outputB.ts',
					contents: 'file_b',
				};
				return file_b;
			},
		},
	};
	let modC: Gen_Module_Meta = {
		id: join(source_idBC, 'modC.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, modC.id);
				if (file_c1) throw Error('Already generated file_c1');
				if (file_c2) throw Error('Already generated file_c2');
				file_c1 = {
					filename: 'outputC1.ts',
					contents: 'file_c1',
				};
				file_c2 = {
					filename: 'outputC2.ts',
					contents: 'file_c2',
				};
				return [file_c1, file_c2];
			},
		},
	};
	const gen_modulesByInputPath = [modA, modB, modC];
	const genResults = await run_gen(fs, gen_modulesByInputPath, async (_fs, id, contents) =>
		id.endsWith('outputB.ts') ? `${contents}/*FORMATTED*/` : contents,
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
	t.ok(file_a);
	t.equal(resultA.files, [
		{
			contents: file_a.contents,
			id: join(modA.id, '../', file_a.filename),
			origin_id: modA.id,
		},
	]);

	const resultB = genResults.results[1];
	t.ok(resultB?.ok);
	t.ok(file_b);
	t.equal(resultB.files, [
		{
			contents: `${file_b.contents}/*FORMATTED*/`,
			id: join(modB.id, '../', file_b.filename),
			origin_id: modB.id,
		},
	]);
	const resultC = genResults.results[2];
	t.ok(resultC?.ok);
	t.ok(file_c1);
	t.ok(file_c2);
	t.equal(resultC.files, [
		{
			contents: file_c1.contents,
			id: join(modC.id, '../', file_c1.filename),
			origin_id: modC.id,
		},
		{
			contents: file_c2.contents,
			id: join(modC.id, '../', file_c2.filename),
			origin_id: modC.id,
		},
	]);
});

test_gen('failing gen function', async () => {
	const source_idA = resolve('src/foo.gen.ts');
	const source_idB = resolve('src/bar/baz');
	let file_b: undefined | {filename: string; contents: string}; // no file_a because it's never generated
	let genError; // this error should be passed through to the result
	// This is the failing gen module.
	// It's ordered first to test that its failure doesn't cascade.
	let modA: Gen_Module_Meta = {
		id: source_idA,
		mod: {
			gen: async () => {
				genError = Error('This fails for testing');
				throw genError;
			},
		},
	};
	let modB: Gen_Module_Meta = {
		id: join(source_idB, 'modB.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, modB.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'outputB.ts',
					contents: 'file_b',
				};
				return file_b;
			},
		},
	};
	const gen_modulesByInputPath: Gen_Module_Meta[] = [modA, modB];
	const genResults = await run_gen(fs, gen_modulesByInputPath);
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
	t.ok(file_b);
	t.equal(resultB.files, [
		{
			contents: file_b.contents,
			id: join(modB.id, '../', file_b.filename),
			origin_id: modB.id,
		},
	]);
});

test_gen.run();
/* /test_gen */
