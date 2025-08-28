import {test, expect, assert} from 'vitest';
import {resolve, join} from 'node:path';
import {Timings} from '@ryanatkn/belt/timings.js';
import {Logger} from '@ryanatkn/belt/log.js';

import type {Genfile_Module_Meta} from './gen.ts';
import {run_gen} from './run_gen.ts';
import {load_gro_config} from './gro_config.ts';

const log = new Logger('test__run_gen'); // TODO test logger?

test('basic behavior', async () => {
	const path_id_a = resolve('src/foo.gen.ts');
	const path_id_bc = resolve('src/bar/bc');
	let file_a: undefined | {filename: string; content: string};
	let file_b: undefined | {filename: string; content: string};
	let file_c1: undefined | {filename: string; content: string};
	let file_c2: undefined | {filename: string; content: string};
	const mod_a: Genfile_Module_Meta = {
		id: path_id_a,
		mod: {
			gen: (ctx) => {
				expect(ctx.origin_id).toBe(path_id_a);
				if (file_a) throw Error('Already generated file_a');
				file_a = {
					filename: 'foo.ts',
					content: 'file_a',
				};
				return file_a.content; // here we return the shorthand version
			},
		},
	};
	const mod_b: Genfile_Module_Meta = {
		id: join(path_id_bc, 'mod_b.gen.ts'),
		mod: {
			gen: (ctx) => {
				expect(ctx.origin_id).toBe(mod_b.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'output_b.ts',
					content: 'file_b',
				};
				return file_b;
			},
		},
	};
	const mod_c: Genfile_Module_Meta = {
		id: join(path_id_bc, 'mod_c.gen.ts'),
		mod: {
			gen: (ctx) => {
				expect(ctx.origin_id).toBe(mod_c.id);
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
		await load_gro_config(),
		log,
		new Timings(),
		(content, opts) =>
			Promise.resolve(opts.filepath!.endsWith('output_b.ts') ? `${content}/*FORMATTED*/` : content),
	);
	expect(gen_results.input_count).toBe(3);
	expect(gen_results.output_count).toBe(4);
	expect(gen_results.successes.length).toBe(3);
	expect(gen_results.failures.length).toBe(0);
	expect(gen_results.results.length).toBe(3);
	expect(gen_results.results[0]).toBe(gen_results.successes[0]);
	expect(gen_results.results[1]).toBe(gen_results.successes[1]);
	expect(gen_results.results[2]).toBe(gen_results.successes[2]);

	const result_a = gen_results.results[0];
	assert.ok(result_a.ok);
	assert.ok(file_a);
	expect(result_a.files).toEqual([
		{
			content: file_a.content,
			id: join(mod_a.id, '../', file_a.filename),
			origin_id: mod_a.id,
			format: true,
		},
	]);

	const result_b = gen_results.results[1];
	assert.ok(result_b.ok);
	assert.ok(file_b);
	expect(result_b.files).toEqual([
		{
			content: `${file_b.content}/*FORMATTED*/`,
			id: join(mod_b.id, '../', file_b.filename),
			origin_id: mod_b.id,
			format: true,
		},
	]);
	const result_c = gen_results.results[2];
	assert.ok(result_c.ok);
	assert.ok(file_c1);
	assert.ok(file_c2);
	expect(result_c.files).equals([
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

test('failing gen function', async () => {
	const path_id_a = resolve('src/foo.gen.ts');
	const path_idB = resolve('src/bar/baz');
	let file_b: undefined | {filename: string; content: string}; // no file_a because it's never generated
	let genError; // this error should be passed through to the result
	// This is the failing gen module.
	// It's ordered first to test that its failure doesn't cascade.
	const mod_a: Genfile_Module_Meta = {
		id: path_id_a,
		mod: {
			gen: () => {
				genError = Error('This fails for testing');
				throw genError;
			},
		},
	};
	const mod_b: Genfile_Module_Meta = {
		id: join(path_idB, 'mod_b.gen.ts'),
		mod: {
			gen: (ctx) => {
				expect(ctx.origin_id).toBe(mod_b.id);
				if (file_b) throw Error('Already generated file_b');
				file_b = {
					filename: 'output_b.ts',
					content: 'file_b',
				};
				return file_b;
			},
		},
	};
	const gen_modules_by_input_path: Array<Genfile_Module_Meta> = [mod_a, mod_b];
	const gen_results = await run_gen(
		gen_modules_by_input_path,
		await load_gro_config(),
		log,
		new Timings(),
	);
	expect(gen_results.input_count).toBe(2);
	expect(gen_results.output_count).toBe(1);
	expect(gen_results.successes.length).toBe(1);
	expect(gen_results.failures.length).toBe(1);
	expect(gen_results.results.length).toBe(2);
	expect(gen_results.results[0]).toBe(gen_results.failures[0]);
	expect(gen_results.results[1]).toBe(gen_results.successes[0]);

	const result_a = gen_results.results[0];
	assert.ok(result_a);
	assert.ok(!result_a.ok);
	assert.ok(result_a.reason);
	assert.ok(result_a.error);

	const result_b = gen_results.results[1];
	assert.ok(result_b.ok);
	assert.ok(file_b);
	expect(result_b.files).toEqual([
		{
			content: file_b.content,
			id: join(mod_b.id, '../', file_b.filename),
			origin_id: mod_b.id,
			format: true,
		},
	]);
});
