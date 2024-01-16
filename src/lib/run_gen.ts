import {red} from 'kleur/colors';
import {print_error} from '@ryanatkn/util/print.js';
import type {Timings} from '@ryanatkn/util/timings.js';
import type {Logger} from '@ryanatkn/util/log.js';
import {Unreachable_Error} from '@ryanatkn/util/error.js';
import {strip_end} from '@ryanatkn/util/string.js';

import {type Gen_Module_Meta, GEN_SCHEMA_PATH_SUFFIX} from './gen_module.js';
import {
	type Gen_Results,
	type Gen_Module_Result,
	type Gen_Context,
	type Gen_Module_Result_Success,
	type Gen_Module_Result_Failure,
	to_gen_result,
	type Raw_Gen_Result,
} from './gen.js';
import {print_path, source_id_to_base_path} from './paths.js';
import type {format_file as base_format_file} from './format_file.js';

export const GEN_NO_PROD_MESSAGE = 'gen runs only during development';

export const run_gen = async (
	gen_modules: Gen_Module_Meta[],
	log: Logger,
	timings: Timings,
	format_file?: typeof base_format_file,
): Promise<Gen_Results> => {
	let input_count = 0;
	let output_count = 0;
	const timing_for_run_gen = timings.start('run_gen');
	const results = await Promise.all(
		gen_modules.map(async (module_meta): Promise<Gen_Module_Result> => {
			input_count++;
			const {id} = module_meta;
			const timing_for_module = timings.start(id);

			// Perform code generation by calling `gen` on the module.
			const gen_ctx: Gen_Context = {origin_id: id, log};
			let raw_gen_result: Raw_Gen_Result;
			try {
				switch (module_meta.type) {
					case 'basic': {
						raw_gen_result = await module_meta.mod.gen(gen_ctx);
						break;
					}
					default: {
						throw new Unreachable_Error(module_meta.type);
					}
				}
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
		successes: results.filter((r) => r.ok) as Gen_Module_Result_Success[],
		failures: results.filter((r) => !r.ok) as Gen_Module_Result_Failure[],
		input_count,
		output_count,
		elapsed: timing_for_run_gen(),
	};
};

// TODO configurable
export const to_gen_import_path = (id: string): string =>
	'$' + strip_end(source_id_to_base_path(id), GEN_SCHEMA_PATH_SUFFIX);
