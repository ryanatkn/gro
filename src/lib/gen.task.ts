import {red, green, gray} from 'kleur/colors';
import {print_ms, print_error} from '@ryanatkn/belt/print.js';
import {plural} from '@ryanatkn/belt/string.js';
import {z} from 'zod';
import {dirname} from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';

import {Task_Error, type Task} from './task.js';
import {run_gen} from './run_gen.js';
import {load_gen_module, check_gen_modules, find_gen_modules} from './gen_module.js';
import {Raw_Input_Path, to_input_paths} from './input_path.js';
import {load_modules} from './modules.js';
import {format_file} from './format_file.js';
import {paths, print_path} from './paths.js';
import {log_error_reasons} from './task_logging.js';

export const Args = z
	.object({
		_: z.array(Raw_Input_Path, {description: 'paths to generate'}).default([]),
		check: z
			.boolean({description: 'exit with a nonzero code if any files need to be generated'})
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

// TODO test - especially making sure nothing gets genned
// if there's any validation or import errors
export const task: Task<Args> = {
	summary: 'run code generation scripts',
	Args,
	run: async ({args, log, timings}): Promise<void> => {
		const {_: raw_input_paths, check} = args;

		const input_paths = raw_input_paths.length ? to_input_paths(raw_input_paths) : [paths.source];

		// load all of the gen modules
		const find_modules_result = await find_gen_modules(input_paths);
		if (!find_modules_result.ok) {
			if (find_modules_result.type === 'input_directories_with_no_files') {
				log.info('no gen modules found');
				return;
			} else {
				log_error_reasons(log, find_modules_result.reasons);
				throw new Task_Error('Failed to find gen modules.');
			}
		}
		log.info('gen files', Array.from(find_modules_result.source_ids_by_input_path.values()).flat());
		const load_modules_result = await load_modules(
			find_modules_result.source_ids_by_input_path,
			load_gen_module,
		);
		if (!load_modules_result.ok) {
			log_error_reasons(log, load_modules_result.reasons);
			throw new Task_Error('Failed to load gen modules.');
		}

		// run `gen` on each of the modules
		const timing_to_generate_code = timings.start('generate code'); // TODO this ignores `gen_results.elapsed` - should it return `Timings` instead?
		const gen_results = await run_gen(load_modules_result.modules, log, timings, format_file);
		timing_to_generate_code();

		const fail_count = gen_results.failures.length;
		if (check) {
			// check if any files changed, and if so, throw errors,
			// but if there are gen failures, skip the check and defer to their errors
			if (!fail_count) {
				log.info('checking generated files for changes');
				const timing_to_check_results = timings.start('check results for changes');
				const check_gen_modules_results = await check_gen_modules(gen_results);
				timing_to_check_results();

				let has_unexpected_changes = false;
				for (const result of check_gen_modules_results) {
					if (!result.has_changed) continue;
					has_unexpected_changes = true;
					log.error(
						red(
							`Generated file ${print_path(result.file.id)} via ${print_path(
								result.file.origin_id,
							)} ${result.is_new ? 'is new' : 'has changed'}.`,
						),
					);
				}
				if (has_unexpected_changes) {
					throw new Task_Error(
						'Failed gen check. Some generated files have unexpectedly changed.' +
							' Run `gro gen` and try again.',
					);
				}
				log.info('check passed, no files have changed');
			}
		} else {
			// write generated files to disk
			log.info('writing generated files to disk');
			const timing_to_output_results = timings.start('output results');
			await Promise.all(
				gen_results.successes
					.map((result) =>
						result.files.map(async (file) => {
							log.info(
								'writing',
								print_path(file.id),
								'generated from',
								print_path(file.origin_id),
							);
							await mkdir(dirname(file.id), {recursive: true});
							await writeFile(file.id, file.content);
						}),
					)
					.flat(),
			);
			timing_to_output_results();
		}

		let logResult = '';
		for (const result of gen_results.results) {
			logResult += `\n\t${result.ok ? green('✓') : red('🞩')}  ${
				result.ok ? result.files.length : 0
			} ${gray('in')} ${print_ms(result.elapsed)} ${gray('←')} ${print_path(result.id)}`;
		}
		log.info(logResult);
		log.info(
			green(
				`generated ${gen_results.output_count} file${plural(gen_results.output_count)} from ${
					gen_results.successes.length
				} input file${plural(gen_results.successes.length)}`,
			),
		);

		if (fail_count) {
			for (const result of gen_results.failures) {
				log.error(result.reason, '\n', print_error(result.error));
			}
			throw new Task_Error(`Failed to generate ${fail_count} file${plural(fail_count)}.`);
		}
	},
};
