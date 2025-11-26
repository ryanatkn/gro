import {styleText as st} from 'node:util';
import {print_error} from '@ryanatkn/belt/print.js';
import type {Timings} from '@ryanatkn/belt/timings.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import {map_concurrent} from '@ryanatkn/belt/async.js';

import {
	type GenResults,
	type GenfileModuleResult,
	type GenContext,
	type GenfileModuleMeta,
	to_gen_result,
	type RawGenResult,
	normalize_gen_config,
} from './gen.ts';
import {print_path, to_root_path} from './paths.ts';
import type {format_file as base_format_file} from './format_file.ts';
import type {GroConfig} from './gro_config.ts';
import {default_svelte_config} from './svelte_config.ts';
import type {Filer} from './filer.ts';
import type {InvokeTask} from './task.ts';

export const GEN_NO_PROD_MESSAGE = 'gen runs only during development';

export const run_gen = async (
	gen_modules: Array<GenfileModuleMeta>,
	config: GroConfig,
	filer: Filer,
	log: Logger,
	timings: Timings,
	invoke_task: InvokeTask,
	format_file?: typeof base_format_file,
): Promise<GenResults> => {
	let input_count = 0;
	let output_count = 0;
	const timing_for_run_gen = timings.start('run_gen');
	const results = await map_concurrent(
		gen_modules,
		async (module_meta): Promise<GenfileModuleResult> => {
			input_count++;
			const {id} = module_meta;
			const timing_for_module = timings.start(id);

			const gen_config = normalize_gen_config(module_meta.mod.gen);
			const gen_ctx: GenContext = {
				config,
				svelte_config: default_svelte_config,
				filer,
				log,
				timings,
				invoke_task,
				origin_id: id,
				origin_path: to_root_path(id),
				changed_file_id: undefined,
			};
			let raw_gen_result: RawGenResult;
			try {
				raw_gen_result = await gen_config.generate(gen_ctx);
			} catch (err) {
				return {
					ok: false,
					id,
					error: err,
					reason: st('red', `Error generating ${print_path(id)}`),
					elapsed: timing_for_module(),
				};
			}

			// Convert the module's return value to a normalized form.
			const gen_result = to_gen_result(id, raw_gen_result);

			// Format the files if needed.
			const files = format_file
				? await map_concurrent(
						gen_result.files,
						async (file) => {
							if (!file.format) return file;
							try {
								return {...file, content: await format_file(file.content, {filepath: file.id})};
							} catch (err) {
								log.error(
									st('red', `Error formatting ${print_path(file.id)} via ${print_path(id)}`),
									print_error(err),
								);
								return file;
							}
						},
						10,
					)
				: gen_result.files;

			output_count += files.length;
			return {
				ok: true,
				id,
				files,
				elapsed: timing_for_module(),
			};
		},
		10,
	);
	return {
		results,
		successes: results.filter((r) => r.ok),
		failures: results.filter((r) => !r.ok),
		input_count,
		output_count,
		elapsed: timing_for_run_gen(),
	};
};
