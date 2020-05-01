import {Task} from './task/task.js';
import {TestContext} from './oki/TestContext.js';
import {resolveRawInputPaths, getPossibleSourceIds} from './fs/inputPaths.js';
import {findFiles} from './fs/nodeFs.js';
import {findModules, loadModules} from './fs/modules.js';
import {TEST_FILE_SUFFIX, isTestPath} from './oki/testModule.js';
import {fmtMs} from './utils/fmt.js';
import {Timings} from './utils/time.js';
import * as report from './oki/report.js';

export const task: Task = {
	description: 'Run tests',
	run: async ({log: {info, error}, args}): Promise<void> => {
		const rawInputPaths = args._;

		const timings = new Timings<'total'>();
		timings.start('total');

		const inputPaths = resolveRawInputPaths(rawInputPaths);

		const testContext = new TestContext({report});

		const findModulesResult = await findModules(
			inputPaths,
			id => findFiles(id, file => isTestPath(file.path)),
			inputPath => getPossibleSourceIds(inputPath, [TEST_FILE_SUFFIX]),
		);
		if (!findModulesResult.ok) {
			for (const reason of findModulesResult.reasons) {
				error(reason);
			}
			return;
		}

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
				error(reason);
			}
			return;
		}

		// The test modules register themselves with the testContext when imported,
		// so we don't pass them as a parameter to run them.
		// They're available as `result.modules` though.
		const testRunResult = await testContext.run();

		info(
			`${fmtMs(
				findModulesResult.timings.get('map input paths'),
			)} to map input paths`,
		);
		info(`${fmtMs(findModulesResult.timings.get('find files'))} to find files`);
		info(
			`${fmtMs(loadModulesResult.timings.get('load modules'))} to load modules`,
		);
		// TODO this gets duplicated by the oki reporter
		info(`${fmtMs(testRunResult.timings.get('total'))} to run tests`);
		info(`🕒 ${fmtMs(timings.stop('total'))}`);
	},
};
