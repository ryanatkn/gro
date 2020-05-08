import {Task} from './task/task.js';
import {TestContext} from './oki/TestContext.js';
import {resolveRawInputPaths, getPossibleSourceIds} from './fs/inputPath.js';
import {findFiles} from './fs/nodeFs.js';
import {findModules, loadModules} from './fs/modules.js';
import {TEST_FILE_SUFFIX, isTestPath} from './oki/testModule.js';
import {printMs, printSubTiming} from './utils/print.js';
import {Timings} from './utils/time.js';
import * as report from './oki/report.js';

export const task: Task = {
	description: 'Run tests',
	run: async ({log, args}): Promise<void> => {
		const rawInputPaths = args._;

		const timings = new Timings<'total'>();
		timings.start('total');
		const subTimings = new Timings();

		const inputPaths = resolveRawInputPaths(rawInputPaths);

		const testContext = new TestContext({report});

		const findModulesResult = await findModules(
			inputPaths,
			id => findFiles(id, file => isTestPath(file.path)),
			inputPath => getPossibleSourceIds(inputPath, [TEST_FILE_SUFFIX]),
		);
		if (!findModulesResult.ok) {
			for (const reason of findModulesResult.reasons) {
				log.error(reason);
			}
			return;
		}
		subTimings.merge(findModulesResult.timings);

		// The test context needs to link its imported modules
		// to their execution context, so its API is a bit complex.
		// See the comment on `TestContext.beginImporting` for more.
		const finishImporting = testContext.beginImporting();
		const loadModulesResult = await loadModules(
			findModulesResult.sourceIdsByInputPath,
			id => testContext.importModule(id),
		);
		finishImporting();
		if (!loadModulesResult.ok) {
			for (const reason of loadModulesResult.reasons) {
				log.error(reason);
			}
			return;
		}
		subTimings.merge(loadModulesResult.timings);

		// The test modules register themselves with the testContext when imported,
		// so we don't pass them as a parameter to run them.
		// They're available as `result.modules` though.
		const testRunResult = await testContext.run();
		subTimings.merge(testRunResult.timings);

		for (const [key, timing] of subTimings.getAll()) {
			log.trace(printSubTiming(key, timing));
		}
		log.info(`🕒 ${printMs(timings.stop('total'))}`);
	},
};
