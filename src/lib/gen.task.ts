import {red, green, gray} from 'kleur/colors';
import {printMs, printError} from '@feltjs/util/print.js';
import {plural} from '@feltjs/util/string.js';
import {z} from 'zod';
import {dirname} from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';

import {TaskError, type Task} from './task/task.js';
import {run_gen} from './gen/run_gen.js';
import {load_gen_module, checkGenModules, find_gen_modules} from './gen/gen_module.js';
import {resolve_raw_input_paths} from './util/input_path.js';
import {load_modules} from './util/modules.js';
import {format_file} from './format/format_file.js';
import {print_path} from './util/paths.js';
import {log_error_reasons} from './task/log_task.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'paths to generate'}).default([]),
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

		// resolve the input paths relative to src/lib/
		const input_paths = resolve_raw_input_paths(raw_input_paths);

		// load all of the gen modules
		const find_modules_result = await find_gen_modules(input_paths);
		if (!find_modules_result.ok) {
			log_error_reasons(log, find_modules_result.reasons);
			throw new TaskError('Failed to find gen modules.');
		}
		log.info('gen files', Array.from(find_modules_result.source_ids_by_input_path.values()).flat());
		const load_modules_result = await load_modules(
			find_modules_result.source_ids_by_input_path,
			load_gen_module,
		);
		if (!load_modules_result.ok) {
			log_error_reasons(log, load_modules_result.reasons);
			throw new TaskError('Failed to load gen modules.');
		}

		// run `gen` on each of the modules
		const stopTimingToGenerateCode = timings.start('generate code'); // TODO this ignores `gen_results.elapsed` - should it return `Timings` instead?
		const gen_results = await run_gen(load_modules_result.modules, log, timings, format_file);
		stopTimingToGenerateCode();

		const failCount = gen_results.failures.length;
		if (check) {
			// check if any files changed, and if so, throw errors,
			// but if there are gen failures, skip the check and defer to their errors
			if (!failCount) {
				log.info('checking generated files for changes');
				const stopTimingToCheckResults = timings.start('check results for changes');
				const checkGenModulesResults = await checkGenModules(gen_results);
				stopTimingToCheckResults();

				let hasUnexpectedChanges = false;
				for (const result of checkGenModulesResults) {
					if (!result.has_changed) continue;
					hasUnexpectedChanges = true;
					log.error(
						red(
							`Generated file ${print_path(result.file.id)} via ${print_path(
								result.file.origin_id,
							)} ${result.is_new ? 'is new' : 'has changed'}.`,
						),
					);
				}
				if (hasUnexpectedChanges) {
					throw new TaskError(
						'Failed gen check. Some generated files have unexpectedly changed.' +
							' Run `gro gen` and try again.',
					);
				}
				log.info('check passed, no files have changed');
			}
		} else {
			// write generated files to disk
			log.info('writing generated files to disk');
			const stopTimingToOutputResults = timings.start('output results');
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
			stopTimingToOutputResults();
		}

		let logResult = '';
		for (const result of gen_results.results) {
			logResult += `\n\t${result.ok ? green('✓') : red('🞩')}  ${
				result.ok ? result.files.length : 0
			} ${gray('in')} ${printMs(result.elapsed)} ${gray('←')} ${print_path(result.id)}`;
		}
		log.info(logResult);
		log.info(
			green(
				`generated ${gen_results.output_count} file${plural(gen_results.output_count)} from ${
					gen_results.successes.length
				} input file${plural(gen_results.successes.length)}`,
			),
		);

		if (failCount) {
			for (const result of gen_results.failures) {
				log.error(result.reason, '\n', printError(result.error));
			}
			throw new TaskError(`Failed to generate ${failCount} file${plural(failCount)}.`);
		}
	},
};
