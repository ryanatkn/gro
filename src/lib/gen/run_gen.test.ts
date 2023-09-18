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
	const source_id_a = resolve('src/foo.gen.ts');
	const source_id_bc = resolve('src/bar/bc');
	let file_a: undefined | {filename: string; content: string};
	let file_b: undefined | {filename: string; content: string};
	let file_c1: undefined | {filename: string; content: string};
	let file_c2: undefined | {filename: string; content: string};
	const mod_a: GenModuleMeta = {
		type: 'basic',
		id: source_id_a,
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, source_id_a);
				if (file_a) throw Error('Already generated file_a');
				file_a = {
					filename: 'foo.ts',
					content: 'file_a',
				};
				return file_a.content; // here we return the shorthand version
			},
		},
	};
	const mod_b: GenModuleMeta = {
		type: 'basic',
		id: join(source_id_bc, 'mod_b.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, mod_b.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'output_b.ts',
					content: 'file_b',
				};
				return file_b;
			},
		},
	};
	const mod_c: GenModuleMeta = {
		type: 'basic',
		id: join(source_id_bc, 'mod_c.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, mod_c.id);
				if (file_c1) throw Error('Already generated file_c1');
				if (file_c2) throw Error('Already generated file_c2');
				file_c1 = {
					filename: 'output_c1.ts',
					content: 'file_c1',
				};
				file_c2 = {
					filename: 'output_c2.ts',
					content: 'file_c2',
				};
				return [file_c1, file_c2];
			},
		},
	};
	const gen_modules_by_input_path = [mod_a, mod_b, mod_c];
	const gen_results = await run_gen(
		gen_modules_by_input_path,
		log,
		new Timings(),
		async (id, content) => (id.endsWith('output_b.ts') ? `${content}/*FORMATTED*/` : content),
	);
	assert.is(gen_results.input_count, 3);
	assert.is(gen_results.output_count, 4);
	assert.is(gen_results.successes.length, 3);
	assert.is(gen_results.failures.length, 0);
	assert.is(gen_results.results.length, 3);
	assert.is(gen_results.results[0], gen_results.successes[0]);
	assert.is(gen_results.results[1], gen_results.successes[1]);
	assert.is(gen_results.results[2], gen_results.successes[2]);

	const result_a = gen_results.results[0];
	assert.ok(result_a?.ok);
	assert.ok(file_a);
	assert.equal(result_a.files, [
		{
			content: file_a.content,
			id: join(mod_a.id, '../', file_a.filename),
			origin_id: mod_a.id,
			format: true,
		},
	]);

	const result_b = gen_results.results[1];
	assert.ok(result_b?.ok);
	assert.ok(file_b);
	assert.equal(result_b.files, [
		{
			content: `${file_b.content}/*FORMATTED*/`,
			id: join(mod_b.id, '../', file_b.filename),
			origin_id: mod_b.id,
			format: true,
		},
	]);
	const result_c = gen_results.results[2];
	assert.ok(result_c?.ok);
	assert.ok(file_c1);
	assert.ok(file_c2);
	assert.equal(result_c.files, [
		{
			content: file_c1.content,
			id: join(mod_c.id, '../', file_c1.filename),
			origin_id: mod_c.id,
			format: true,
		},
		{
			content: file_c2.content,
			id: join(mod_c.id, '../', file_c2.filename),
			origin_id: mod_c.id,
			format: true,
		},
	]);
});

test__gen('failing gen function', async () => {
	const source_id_a = resolve('src/foo.gen.ts');
	const source_idB = resolve('src/bar/baz');
	let file_b: undefined | {filename: string; content: string}; // no file_a because it's never generated
	let genError; // this error should be passed through to the result
	// This is the failing gen module.
	// It's ordered first to test that its failure doesn't cascade.
	const mod_a: GenModuleMeta = {
		type: 'basic',
		id: source_id_a,
		mod: {
			gen: async () => {
				genError = Error('This fails for testing');
				throw genError;
			},
		},
	};
	const mod_b: GenModuleMeta = {
		type: 'basic',
		id: join(source_idB, 'mod_b.gen.ts'),
		mod: {
			gen: async (ctx) => {
				assert.is(ctx.origin_id, mod_b.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'output_b.ts',
					content: 'file_b',
				};
				return file_b;
			},
		},
	};
	const gen_modules_by_input_path: GenModuleMeta[] = [mod_a, mod_b];
	const gen_results = await run_gen(gen_modules_by_input_path, log, new Timings());
	assert.is(gen_results.input_count, 2);
	assert.is(gen_results.output_count, 1);
	assert.is(gen_results.successes.length, 1);
	assert.is(gen_results.failures.length, 1);
	assert.is(gen_results.results.length, 2);
	assert.is(gen_results.results[0], gen_results.failures[0]);
	assert.is(gen_results.results[1], gen_results.successes[0]);

	const result_a = gen_results.results[0];
	assert.ok(result_a);
	assert.ok(!result_a?.ok);
	assert.ok(result_a.reason);
	assert.ok(result_a.error);

	const result_b = gen_results.results[1];
	assert.ok(result_b?.ok);
	assert.ok(file_b);
	assert.equal(result_b.files, [
		{
			content: file_b.content,
			id: join(mod_b.id, '../', file_b.filename),
			origin_id: mod_b.id,
			format: true,
		},
	]);
});

test__gen.run();
/* test__gen */
