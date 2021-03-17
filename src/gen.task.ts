import {red, green, gray} from './utils/terminal.js';
import {outputFile} from './fs/nodeFs.js';
import {Task, TaskError} from './task/task.js';
import {runGen} from './gen/runGen.js';
import {loadGenModule, checkGenModules, findGenModules} from './gen/genModule.js';
import {printPath, printMs, printError, printTiming} from './utils/print.js';
import {resolveRawInputPaths} from './fs/inputPath.js';
import {plural} from './utils/string.js';
import {createStopwatch, Timings} from './utils/time.js';
import {loadModules} from './fs/modules.js';
import {formatFile} from './build/formatFile.js';

// TODO test - especially making sure nothing gets genned
// if there's any validation or import errors
export const task: Task = {
	description: 'run code generation scripts',
	run: async ({log, args}): Promise<void> => {
		const rawInputPaths = args._;
		const check = !!args.check; // TODO args declaration and validation

		const totalTiming = createStopwatch();
		const timings = new Timings();

		// resolve the input paths relative to src/
		const inputPaths = resolveRawInputPaths(rawInputPaths);

		// load all of the gen modules
		const findModulesResult = await findGenModules(inputPaths);
		if (!findModulesResult.ok) {
			for (const reason of findModulesResult.reasons) {
				log.error(reason);
			}
			throw new TaskError('Failed to find gen modules.');
		}
		timings.merge(findModulesResult.timings);
		const loadModulesResult = await loadModules(
			findModulesResult.sourceIdsByInputPath,
			loadGenModule,
		);
		if (!loadModulesResult.ok) {
			for (const reason of loadModulesResult.reasons) {
				log.error(reason);
			}
			throw new TaskError('Failed to load gen modules.');
		}
		timings.merge(loadModulesResult.timings);

		// run `gen` on each of the modules
		const stopTimingToGenerateCode = timings.start('generate code'); // TODO this ignores `genResults.elapsed` - should it return `Timings` instead?
		const genResults = await runGen(loadModulesResult.modules, formatFile);
		stopTimingToGenerateCode();

		const failCount = genResults.failures.length;
		if (check) {
			// check if any files changed, and if so, throw errors,
			// but if there are gen failures, skip the check and defer to their errors
			if (!failCount) {
				log.info('checking generated files for changes');
				const stopTimingToCheckResults = timings.start('check results for changes');
				const checkGenModulesResults = await checkGenModules(genResults);
				stopTimingToCheckResults();

				let hasUnexpectedChanges = false;
				for (const result of checkGenModulesResults) {
					if (!result.hasChanged) continue;
					hasUnexpectedChanges = true;
					log.error(
						red(
							`Generated file ${printPath(result.file.id)} via ${printPath(result.file.originId)} ${
								result.isNew ? 'is new' : 'has changed'
							}.`,
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
							log.info('writing', printPath(file.id), 'generated from', printPath(file.originId));
							return outputFile(file.id, file.contents);
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
			} ${gray('in')} ${printMs(result.elapsed)} ${gray('←')} ${printPath(result.id)}`;
		}
		log.info(logResult);
		log.info(
			green(
				`generated ${genResults.outputCount} file${plural(genResults.outputCount)} from ${
					genResults.successes.length
				} input file${plural(genResults.successes.length)}`,
			),
		);
		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
		log.info(`🕒 ${printMs(totalTiming())}`);

		if (failCount) {
			for (const result of genResults.failures) {
				log.error(result.reason, '\n', printError(result.error));
			}
			throw new TaskError(`Failed to generate ${failCount} file${plural(failCount)}.`);
		}
	},
};
