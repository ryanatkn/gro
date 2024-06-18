import {red, green, gray} from 'kleur/colors';
import {print_ms, print_error} from '@ryanatkn/belt/print.js';
import {plural} from '@ryanatkn/belt/string.js';
import {z} from 'zod';

import {Task_Error, type Task} from './task.js';
import {run_gen} from './run_gen.js';
import {load_gen_module, find_genfiles} from './gen_module.js';
import {Raw_Input_Path, to_input_paths} from './input_path.js';
import {load_modules} from './modules.js';
import {format_file} from './format_file.js';
import {paths, print_path} from './paths.js';
import {log_error_reasons} from './task_logging.js';
import {write_gen_results, analyze_gen_results} from './gen.js';

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
	run: async ({args, log, timings, config}): Promise<void> => {
		const {_: raw_input_paths, check} = args;

		const input_paths = raw_input_paths.length ? to_input_paths(raw_input_paths) : [paths.source];

		// load all of the gen modules
		const find_modules_result = await find_genfiles(input_paths);
		console.log(`find_modules_result`, find_modules_result);
		if (!find_modules_result.ok) {
			if (find_modules_result.type === 'input_directories_with_no_files') {
				log.info('no gen modules found');
				return;
			} else {
				log_error_reasons(log, find_modules_result.reasons);
				throw new Task_Error('Failed to find gen modules.');
			}
		}
		log.info('gen files', Array.from(find_modules_result.path_ids_by_input_path.values()).flat());
		const load_modules_result = await load_modules(
			find_modules_result.resolved_input_paths,
			load_gen_module,
		);
		if (!load_modules_result.ok) {
			log_error_reasons(log, load_modules_result.reasons);
			throw new Task_Error('Failed to load gen modules.');
		}

		// run `gen` on each of the modules
		const timing_to_generate_code = timings.start('generate code'); // TODO this ignores `gen_results.elapsed` - should it return `Timings` instead?
		const gen_results = await run_gen(
			load_modules_result.modules,
			config,
			log,
			timings,
			format_file,
		);
		timing_to_generate_code();

		const fail_count = gen_results.failures.length;
		const analyzed_gen_results = await analyze_gen_results(gen_results);
		if (check) {
			// check if any files changed, and if so, throw errors,
			// but if there are gen failures, skip the check and defer to their errors
			if (!fail_count) {
				log.info('checking generated files for changes');
				const timing_to_check_results = timings.start('check results for changes');
				timing_to_check_results();

				let has_unexpected_changes = false;
				for (const analyzed of analyzed_gen_results) {
					if (!analyzed.has_changed) continue;
					has_unexpected_changes = true;
					log.error(
						red(
							`Generated file ${print_path(analyzed.file.id)} via ${print_path(
								analyzed.file.origin_id,
							)} ${analyzed.is_new ? 'is new' : 'has changed'}.`,
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
			await write_gen_results(gen_results, analyzed_gen_results, log);
			timing_to_output_results();
		}

		// TODO these final printed results could be improved showing a breakdown per file id
		const new_count = analyzed_gen_results.filter((r) => r.is_new).length;
		const changed_count = analyzed_gen_results.filter((r) => r.has_changed).length;
		const skipped_count = analyzed_gen_results.filter((r) => !r.is_new && !r.has_changed).length;
		let log_result = green('gen results:');
		log_result += `\n\t${new_count} ` + gray('new');
		log_result += `\n\t${changed_count} ` + gray('changed');
		log_result += `\n\t${skipped_count} ` + gray('skipped');
		for (const result of gen_results.results) {
			log_result += `\n\t${result.ok ? green('✓') : red('🞩')}  ${
				result.ok ? result.files.length : 0
			} ${gray('in')} ${print_ms(result.elapsed)} ${gray('←')} ${print_path(result.id)}`;
		}
		log.info(log_result);
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
