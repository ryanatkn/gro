import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import type {Gen_Module_Meta} from './gen_module.js';
import {run_gen} from './run_gen.js';
import {fs} from '../fs/node.js';

/* test_gen */
const test_gen = suite('gen');

test_gen('basic behavior', async () => {
	const source_id_a = resolve('src/foo.gen.ts');
	const source_id_b_c = resolve('src/bar/bc');
	let file_a: undefined | {filename: string; contents: string};
	let file_b: undefined | {filename: string; contents: string};
	let file_c1: undefined | {filename: string; contents: string};
	let file_c2: undefined | {filename: string; contents: string};
	let mod_a: Gen_Module_Meta = {
		id: source_id_a,
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, source_id_a);
				if (file_a) throw Error('Already generated file_a');
				file_a = {
					filename: 'foo.ts',
					contents: 'file_a',
				};
				return file_a.contents; // here we return the shorthand version
			},
		},
	};
	let mod_b: Gen_Module_Meta = {
		id: join(source_id_b_c, 'mod_b.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, mod_b.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'outputB.ts',
					contents: 'file_b',
				};
				return file_b;
			},
		},
	};
	let mod_c: Gen_Module_Meta = {
		id: join(source_id_b_c, 'mod_c.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, mod_c.id);
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
	const gen_modules_by_input_path = [mod_a, mod_b, mod_c];
	const gen_results = await run_gen(fs, gen_modules_by_input_path, async (_fs, id, contents) =>
		id.endsWith('outputB.ts') ? `${contents}/*FORMATTED*/` : contents,
	);
	t.is(gen_results.input_count, 3);
	t.is(gen_results.output_count, 4);
	t.is(gen_results.successes.length, 3);
	t.is(gen_results.failures.length, 0);
	t.is(gen_results.results.length, 3);
	t.is(gen_results.results[0], gen_results.successes[0]);
	t.is(gen_results.results[1], gen_results.successes[1]);
	t.is(gen_results.results[2], gen_results.successes[2]);

	const result_a = gen_results.results[0];
	t.ok(result_a?.ok);
	t.ok(file_a);
	t.equal(result_a.files, [
		{
			contents: file_a.contents,
			id: join(mod_a.id, '../', file_a.filename),
			origin_id: mod_a.id,
		},
	]);

	const result_b = gen_results.results[1];
	t.ok(result_b?.ok);
	t.ok(file_b);
	t.equal(result_b.files, [
		{
			contents: `${file_b.contents}/*FORMATTED*/`,
			id: join(mod_b.id, '../', file_b.filename),
			origin_id: mod_b.id,
		},
	]);
	const result_c = gen_results.results[2];
	t.ok(result_c?.ok);
	t.ok(file_c1);
	t.ok(file_c2);
	t.equal(result_c.files, [
		{
			contents: file_c1.contents,
			id: join(mod_c.id, '../', file_c1.filename),
			origin_id: mod_c.id,
		},
		{
			contents: file_c2.contents,
			id: join(mod_c.id, '../', file_c2.filename),
			origin_id: mod_c.id,
		},
	]);
});

test_gen('failing gen function', async () => {
	const source_id_a = resolve('src/foo.gen.ts');
	const source_id_b = resolve('src/bar/baz');
	let file_b: undefined | {filename: string; contents: string}; // no file_a because it's never generated
	let gen_error; // this error should be passed through to the result
	// This is the failing gen module.
	// It's ordered first to test that its failure doesn't cascade.
	let mod_a: Gen_Module_Meta = {
		id: source_id_a,
		mod: {
			gen: async () => {
				gen_error = Error('This fails for testing');
				throw gen_error;
			},
		},
	};
	let mod_b: Gen_Module_Meta = {
		id: join(source_id_b, 'mod_b.gen.ts'),
		mod: {
			gen: async (ctx) => {
				t.is(ctx.origin_id, mod_b.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'outputB.ts',
					contents: 'file_b',
				};
				return file_b;
			},
		},
	};
	const gen_modules_by_input_path: Gen_Module_Meta[] = [mod_a, mod_b];
	const gen_results = await run_gen(fs, gen_modules_by_input_path);
	t.is(gen_results.input_count, 2);
	t.is(gen_results.output_count, 1);
	t.is(gen_results.successes.length, 1);
	t.is(gen_results.failures.length, 1);
	t.is(gen_results.results.length, 2);
	t.is(gen_results.results[0], gen_results.failures[0]);
	t.is(gen_results.results[1], gen_results.successes[0]);

	const result_a = gen_results.results[0];
	t.ok(result_a);
	t.not.ok(result_a?.ok);
	t.ok(result_a.reason);
	t.ok(result_a.error);

	const result_b = gen_results.results[1];
	t.ok(result_b?.ok);
	t.ok(file_b);
	t.equal(result_b.files, [
		{
			contents: file_b.contents,
			id: join(mod_b.id, '../', file_b.filename),
			origin_id: mod_b.id,
		},
	]);
});

test_gen.run();
/* /test_gen */
