import {red, green, gray} from 'kleur/colors';
import {printMs, printError, printTimings} from '@feltcoop/felt/util/print.js';
import {plural} from '@feltcoop/felt/util/string.js';
import {createStopwatch, Timings} from '@feltcoop/felt/util/timings.js';

import {TaskError, type Task} from './task/task.js';
import {runGen} from './gen/runGen.js';
import {loadGenModule, checkGenModules, findGenModules} from './gen/genModule.js';
import {resolveRawInputPaths} from './fs/inputPath.js';
import {loadModules} from './fs/modules.js';
import {formatFile} from './format/formatFile.js';
import {printPath} from './paths.js';
import {loadConfig} from './config/config.js';
import {buildSource} from './build/buildSource.js';
import {type GenTaskArgs} from './gen.js';
import {GenTaskArgsSchema} from './gen.schema.js';

// TODO test - especially making sure nothing gets genned
// if there's any validation or import errors
export const task: Task<GenTaskArgs> = {
	summary: 'run code generation scripts',
	args: GenTaskArgsSchema,
	run: async ({fs, log, args, dev}): Promise<void> => {
		const rawInputPaths = args._;
		const check = !!args.check;

		const totalTiming = createStopwatch();
		const timings = new Timings();

		// TODO won't need to build if `gen` becomes a builder
		// first build everything
		const timingToLoadConfig = timings.start('load config');
		const config = await loadConfig(fs, dev);
		timingToLoadConfig();
		const timingToBuildSource = timings.start('buildSource');
		await buildSource(fs, config, dev, log);
		timingToBuildSource();

		// resolve the input paths relative to src/
		const inputPaths = resolveRawInputPaths(rawInputPaths);

		// load all of the gen modules
		const findModulesResult = await findGenModules(fs, inputPaths);
		if (!findModulesResult.ok) {
			for (const reason of findModulesResult.reasons) {
				log.error(reason);
			}
			throw new TaskError('Failed to find gen modules.');
		}
		timings.merge(findModulesResult.timings);
		const loadModulesResult = await loadModules(
			findModulesResult.sourceIdsByInputPath,
			true,
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
		const genResults = await runGen(fs, loadModulesResult.modules, log, formatFile);
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
		printTimings(timings, log);
		log.info(`🕒 ${printMs(totalTiming())}`);

		if (failCount) {
			for (const result of genResults.failures) {
				log.error(result.reason, '\n', printError(result.error));
			}
			throw new TaskError(`Failed to generate ${failCount} file${plural(failCount)}.`);
		}
	},
};
