import {red, green, gray} from '@feltcoop/felt/util/terminal.js';
import {print_ms, print_error, print_timings} from '@feltcoop/felt/util/print.js';
import {plural} from '@feltcoop/felt/util/string.js';
import {create_stopwatch, Timings} from '@feltcoop/felt/util/time.js';

import type {Task} from './task/task.js';
import {Task_Error} from './task/task.js';
import {run_gen} from './gen/run_gen.js';
import {load_gen_module, check_gen_modules, find_gen_modules} from './gen/gen_module.js';
import {resolve_raw_input_paths} from './fs/input_path.js';
import {load_modules} from './fs/modules.js';
import {format_file} from './build/format_file.js';
import {print_path} from './paths.js';

export interface Task_Args {
	_: string[];
	check?: boolean;
}

// TODO test - especially making sure nothing gets genned
// if there's any validation or import errors
export const task: Task<Task_Args> = {
	summary: 'run code generation scripts',
	run: async ({fs, log, args}): Promise<void> => {
		const rawInputPaths = args._;
		const check = !!args.check;

		const total_timing = create_stopwatch();
		const timings = new Timings();

		// resolve the input paths relative to src/
		const input_paths = resolve_raw_input_paths(rawInputPaths);

		// load all of the gen modules
		const find_modules_result = await find_gen_modules(fs, input_paths);
		if (!find_modules_result.ok) {
			for (const reason of find_modules_result.reasons) {
				log.error(reason);
			}
			throw new Task_Error('Failed to find gen modules.');
		}
		timings.merge(find_modules_result.timings);
		const load_modules_result = await load_modules(
			find_modules_result.source_ids_by_input_path,
			true,
			load_gen_module,
		);
		if (!load_modules_result.ok) {
			for (const reason of load_modules_result.reasons) {
				log.error(reason);
			}
			throw new Task_Error('Failed to load gen modules.');
		}
		timings.merge(load_modules_result.timings);

		// run `gen` on each of the modules
		const stop_timing_to_generate_code = timings.start('generate code'); // TODO this ignores `gen_results.elapsed` - should it return `Timings` instead?
		const gen_results = await run_gen(fs, load_modules_result.modules, log, format_file);
		stop_timing_to_generate_code();

		const fail_count = gen_results.failures.length;
		if (check) {
			// check if any files changed, and if so, throw errors,
			// but if there are gen failures, skip the check and defer to their errors
			if (!fail_count) {
				log.info('checking generated files for changes');
				const stop_timing_to_check_results = timings.start('check results for changes');
				const check_gen_modules_results = await check_gen_modules(fs, gen_results);
				stop_timing_to_check_results();

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
			const stop_timing_to_output_results = timings.start('output results');
			await Promise.all(
				gen_results.successes
					.map((result) =>
						result.files.map((file) => {
							log.info(
								'writing',
								print_path(file.id),
								'generated from',
								print_path(file.origin_id),
							);
							return fs.write_file(file.id, file.content);
						}),
					)
					.flat(),
			);
			stop_timing_to_output_results();
		}

		let log_result = '';
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
		print_timings(timings, log);
		log.info(`🕒 ${print_ms(total_timing())}`);

		if (fail_count) {
			for (const result of gen_results.failures) {
				log.error(result.reason, '\n', print_error(result.error));
			}
			throw new Task_Error(`Failed to generate ${fail_count} file${plural(fail_count)}.`);
		}
	},
};
