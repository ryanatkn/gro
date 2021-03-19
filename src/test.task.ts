import {Task, TaskError} from './task/task.js';
import {TestContext} from './oki/TestContext.js';
import {resolveRawInputPaths} from './fs/inputPath.js';
import {loadModules} from './fs/modules.js';
import {findTestModules} from './oki/testModule.js';
import {printMs, printTiming} from './utils/print.js';
import {createStopwatch, Timings} from './utils/time.js';
import * as report from './oki/report.js';
import {plural} from './utils/string.js';
import {spawnProcess} from './utils/process.js';

export const task: Task = {
	description: 'run tests',
	run: async ({log, args}): Promise<void> => {
		const rawInputPaths = args._;

		const totalTiming = createStopwatch();
		const timings = new Timings();

		const inputPaths = resolveRawInputPaths(rawInputPaths);

		const testContext = new TestContext({report});

		const findModulesResult = await findTestModules(inputPaths);
		if (!findModulesResult.ok) {
			for (const reason of findModulesResult.reasons) {
				log.error(reason);
			}
			throw new TaskError('Failed to find modules.');
		}
		timings.merge(findModulesResult.timings);

		// The test context needs to link its imported modules
		// to their execution context, so its API is a bit complex.
		// See the comment on `TestContext.beginImporting` for more.
		const finishImporting = testContext.beginImporting();
		const loadModulesResult = await loadModules(findModulesResult.sourceIdsByInputPath, (id) =>
			testContext.importModule(id),
		);
		finishImporting();
		if (!loadModulesResult.ok) {
			for (const reason of loadModulesResult.reasons) {
				log.error(reason);
			}
			throw new TaskError('Failed to load modules.');
		}
		timings.merge(loadModulesResult.timings);

		// The test modules register themselves with the testContext when imported,
		// so we don't pass them as a parameter to run them.
		// They're available as `loadModulesResult.modules` though.
		const testRunResult = await testContext.run();
		timings.merge(testRunResult.timings);

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
		log.info(`🕒 ${printMs(totalTiming())}`);

		if (testRunResult.stats.failCount) {
			throw new TaskError(
				`Failed ${testRunResult.stats.failCount} test${plural(testRunResult.stats.failCount)}.`,
			);
		}

		// TODO !! replace everything above with `uvu`
		await spawnProcess('npx', ['node', '.gro/dev/node/utils/array.uvu.js']);
	},
};
