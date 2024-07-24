import {red} from '@ryanatkn/belt/styletext.js';
import {print_error} from '@ryanatkn/belt/print.js';
import type {Timings} from '@ryanatkn/belt/timings.js';
import type {Logger} from '@ryanatkn/belt/log.js';

import {
	type Gen_Results,
	type Genfile_Module_Result,
	type Gen_Context,
	type Genfile_Module_Meta,
	to_gen_result,
	type Raw_Gen_Result,
} from './gen.js';
import {print_path, to_root_path} from './paths.js';
import type {format_file as base_format_file} from './format_file.js';
import type {Gro_Config} from './gro_config.js';
import {default_sveltekit_config} from './sveltekit_config.js';

export const GEN_NO_PROD_MESSAGE = 'gen runs only during development';

export const run_gen = async (
	gen_modules: Genfile_Module_Meta[],
	config: Gro_Config,
	log: Logger,
	timings: Timings,
	format_file?: typeof base_format_file,
): Promise<Gen_Results> => {
	let input_count = 0;
	let output_count = 0;
	const timing_for_run_gen = timings.start('run_gen');
	const results = await Promise.all(
		gen_modules.map(async (module_meta): Promise<Genfile_Module_Result> => {
			input_count++;
			const {id} = module_meta;
			const timing_for_module = timings.start(id);

			// Perform code generation by calling `gen` on the module.
			const gen_ctx: Gen_Context = {
				config,
				sveltekit_config: default_sveltekit_config,
				origin_id: id,
				origin_path: to_root_path(id),
				log,
			};
			let raw_gen_result: Raw_Gen_Result;
			try {
				raw_gen_result = await module_meta.mod.gen(gen_ctx);
			} catch (err) {
				return {
					ok: false,
					id,
					error: err,
					reason: red(`Error generating ${print_path(id)}`),
					elapsed: timing_for_module(),
				};
			}

			// Convert the module's return value to a normalized form.
			const gen_result = to_gen_result(id, raw_gen_result);

			// Format the files if needed.
			const files = format_file
				? await Promise.all(
						gen_result.files.map(async (file) => {
							if (!file.format) return file;
							try {
								return {...file, content: await format_file(file.content, {filepath: file.id})};
							} catch (err) {
								log.error(
									red(`Error formatting ${print_path(file.id)} via ${print_path(id)}`),
									print_error(err),
								);
								return file;
							}
						}),
					)
				: gen_result.files;

			output_count += files.length;
			return {
				ok: true,
				id,
				files,
				elapsed: timing_for_module(),
			};
		}),
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
