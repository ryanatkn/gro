import {red, green, gray} from '@feltcoop/felt/utils/terminal.js';
import {printMs, print_error, print_timings} from '@feltcoop/felt/utils/print.js';
import {plural} from '@feltcoop/felt/utils/string.js';
import {createStopwatch, Timings} from '@feltcoop/felt/utils/time.js';

import type {Task} from './task/task.js';
import {Task_Error} from './task/task.js';
import {runGen} from './gen/runGen.js';
import {loadGenModule, checkGenModules, find_gen_modules} from './gen/gen_module.js';
import {resolveRawInputPaths} from './fs/inputPath.js';
import {load_modules} from './fs/modules.js';
import {formatFile} from './build/formatFile.js';
import {print_path} from './paths.js';

export interface Task_Args {
	_: string[];
	check?: boolean;
}

// TODO test - especially making sure nothing gets genned
// if there's any validation or import errors
export const task: Task<Task_Args> = {
	description: 'run code generation scripts',
	run: async ({fs, log, args}): Promise<void> => {
		const rawInputPaths = args._;
		const check = !!args.check;

		const totalTiming = createStopwatch();
		const timings = new Timings();

		// resolve the input paths relative to src/
		const inputPaths = resolveRawInputPaths(rawInputPaths);

		// load all of the gen modules
		const find_modules_result = await find_gen_modules(fs, inputPaths);
		if (!find_modules_result.ok) {
			for (const reason of find_modules_result.reasons) {
				log.error(reason);
			}
			throw new Task_Error('Failed to find gen modules.');
		}
		timings.merge(find_modules_result.timings);
		const load_modules_result = await load_modules(
			find_modules_result.source_ids_by_input_path,
			loadGenModule,
		);
		if (!load_modules_result.ok) {
			for (const reason of load_modules_result.reasons) {
				log.error(reason);
			}
			throw new Task_Error('Failed to load gen modules.');
		}
		timings.merge(load_modules_result.timings);

		// run `gen` on each of the modules
		const stopTimingToGenerateCode = timings.start('generate code'); // TODO this ignores `genResults.elapsed` - should it return `Timings` instead?
		const genResults = await runGen(fs, load_modules_result.modules, formatFile, log);
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
								result.file.originId,
							)} ${result.isNew ? 'is new' : 'has changed'}.`,
						),
					);
				}
				if (hasUnexpectedChanges) {
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
			const stopTimingToOutputResults = timings.start('output results');
			await Promise.all(
				genResults.successes
					.map((result) =>
						result.files.map((file) => {
							log.info('writing', print_path(file.id), 'generated from', print_path(file.originId));
							return fs.writeFile(file.id, file.contents);
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
				`generated ${genResults.outputCount} file${plural(genResults.outputCount)} from ${
					genResults.successes.length
				} input file${plural(genResults.successes.length)}`,
			),
		);
		print_timings(timings, log);
		log.info(`🕒 ${printMs(totalTiming())}`);

		if (failCount) {
			for (const result of genResults.failures) {
				log.error(result.reason, '\n', print_error(result.error));
			}
			throw new Task_Error(`Failed to generate ${failCount} file${plural(failCount)}.`);
		}
	},
};
