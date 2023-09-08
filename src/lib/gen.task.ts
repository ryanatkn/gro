import {red, green, gray} from 'kleur/colors';
import {printMs, printError, printTimings} from '@feltjs/util/print.js';
import {plural} from '@feltjs/util/string.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {z} from 'zod';

import {TaskError, type Task} from './task/task.js';
import {runGen} from './gen/runGen.js';
import {loadGenModule, checkGenModules, find_gen_modules} from './gen/genModule.js';
import {resolve_raw_input_paths} from './path/input_path.js';
import {load_modules} from './fs/modules.js';
import {format_file} from './format/format_file.js';
import {print_path} from './path/paths.js';
import {load_config} from './config/config.js';
import {build_source} from './build/build_source.js';
import {log_error_reasons} from './task/log_task.js';

export const Args = z
	.object({
		_: z.array(z.string(), {description: 'paths to generate'}).default([]),
		check: z
			.boolean({description: 'exit with a nonzero code if any files need to be generated'})
			.default(false),
		rebuild: z.boolean({description: 'read this instead of no-rebuild'}).optional().default(true),
		'no-rebuild': z
			.boolean({description: 'opt out of rebuilding the code for efficiency'})
			.optional()
			.default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

// TODO test - especially making sure nothing gets genned
// if there's any validation or import errors
export const task: Task<Args> = {
	summary: 'run code generation scripts',
	Args,
	run: async ({fs, log, args}): Promise<void> => {
		const {_: raw_input_paths, check, rebuild} = args;

		const total_timing = createStopwatch();
		const timings = new Timings();

		// TODO hacky -- running `gro gen` from the command line
		// currently causes it to rebuild by default,
		// but running `gro gen` from dev/build tasks will not want to rebuild.
		if (rebuild) {
			const timing_to_load_config = timings.start('load config');
			const config = await load_config(fs);
			timing_to_load_config();
			const timingToBuildSource = timings.start('build_source');
			await build_source(fs, config, true, log);
			timingToBuildSource();
		}

		// resolve the input paths relative to src/lib/
		const input_paths = resolve_raw_input_paths(raw_input_paths);

		// load all of the gen modules
		const find_modules_result = await find_gen_modules(fs, input_paths);
		if (!find_modules_result.ok) {
			log_error_reasons(log, find_modules_result.reasons);
			throw new TaskError('Failed to find gen modules.');
		}
		log.info('gen files', Array.from(find_modules_result.source_ids_by_input_path.values()).flat());
		timings.merge(find_modules_result.timings);
		const load_modules_result = await load_modules(
			find_modules_result.source_ids_by_input_path,
			true,
			loadGenModule,
		);
		if (!load_modules_result.ok) {
			log_error_reasons(log, load_modules_result.reasons);
			throw new TaskError('Failed to load gen modules.');
		}
		timings.merge(load_modules_result.timings);

		// run `gen` on each of the modules
		const stopTimingToGenerateCode = timings.start('generate code'); // TODO this ignores `genResults.elapsed` - should it return `Timings` instead?
		const genResults = await runGen(fs, load_modules_result.modules, log, format_file);
		stopTimingToGenerateCode();

		const failCount = genResults.failures.length;
		if (check) {
			// check if any files changed, and if so, throw errors,
			// but if there are gen failures, skip the check and defer to their errors
			if (!failCount) {
				log.info('checking generated files for changes');
				const stopTimingToCheckResults = timings.start('check results for changes');
				const checkGenModulesResults = await checkGenModules(fs, genResults);
				stopTimingToCheckResults();

				let hasUnexpectedChanges = false;
				for (const result of checkGenModulesResults) {
					if (!result.hasChanged) continue;
					hasUnexpectedChanges = true;
					log.error(
						red(
							`Generated file ${print_path(result.file.id)} via ${print_path(
								result.file.origin_id,
							)} ${result.isNew ? 'is new' : 'has changed'}.`,
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
				genResults.successes
					.map((result) =>
						result.files.map((file) => {
							log.info(
								'writing',
								print_path(file.id),
								'generated from',
								print_path(file.origin_id),
							);
							return fs.writeFile(file.id, file.content);
						}),
					)
					.flat(),
			);
			stopTimingToOutputResults();
		}

		let logResult = '';
		for (const result of genResults.results) {
			logResult += `\n\t${result.ok ? green('✓') : red('🞩')}  ${
				result.ok ? result.files.length : 0
			} ${gray('in')} ${printMs(result.elapsed)} ${gray('←')} ${print_path(result.id)}`;
		}
		log.info(logResult);
		log.info(
			green(
				`generated ${genResults.output_count} file${plural(genResults.output_count)} from ${
					genResults.successes.length
				} input file${plural(genResults.successes.length)}`,
			),
		);
		printTimings(timings, log);
		log.info(`🕒 ${printMs(total_timing())}`);

		if (failCount) {
			for (const result of genResults.failures) {
				log.error(result.reason, '\n', printError(result.error));
			}
			throw new TaskError(`Failed to generate ${failCount} file${plural(failCount)}.`);
		}
	},
};
