import {red} from '@feltcoop/felt/util/terminal.js';
import {print_error} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';
import type {Logger} from '@feltcoop/felt/util/log.js';

import type {GenModuleMeta} from 'src/gen/gen_module.js';
import {
	GenResults,
	GenModuleResult,
	GenContext,
	to_gen_result,
	GenModuleResultSuccess,
	GenModuleResultFailure,
} from './gen.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import {print_path} from '../paths.js';

export const run_gen = async (
	fs: Filesystem,
	gen_modules: GenModuleMeta[],
	log: Logger,
	format_file?: (fs: Filesystem, id: string, content: string) => Promise<string>,
): Promise<GenResults> => {
	let input_count = 0;
	let output_count = 0;
	const timings = new Timings();
	const timing_for_total = timings.start('total');
	const results = await Promise.all(
		gen_modules.map(async ({id, mod}): Promise<GenModuleResult> => {
			input_count++;
			const genCtx: GenContext = {fs, origin_id: id, log};
			const timing_for_module = timings.start(id);

			// Perform code generation by calling `gen` on the module.
			let raw_gen_result;
			try {
				raw_gen_result = await mod.gen(genCtx);
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
			let files;
			if (format_file) {
				files = [];
				for (const file of gen_result.files) {
					let content: string;
					try {
						content = await format_file(fs, file.id, file.content);
					} catch (err) {
						content = file.content;
						log?.error(
							red(`Error formatting ${print_path(file.id)} via ${print_path(id)}`),
							print_error(err),
						);
					}
					files.push({...file, content});
				}
			} else {
				files = gen_result.files;
			}

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
		successes: results.filter((r) => r.ok) as GenModuleResultSuccess[],
		failures: results.filter((r) => !r.ok) as GenModuleResultFailure[],
		input_count,
		output_count,
		elapsed: timing_for_total(),
	};
};
