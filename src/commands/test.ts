import {blue, magenta} from '../colors/terminal.js';
import {TestContext} from '../oki/TestContext.js';
import {SystemLogger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';
import {resolveRawInputPaths} from '../files/inputPaths.js';
import {findFiles} from '../files/nodeFs.js';
import {loadModules} from '../files/loadModules.js';
import {TEST_FILE_SUFFIX, isTestPath} from '../oki/testModule.js';
import {fmtMs} from '../utils/fmt.js';
import {Timings} from '../utils/time.js';
import * as report from '../oki/report.js';

const {info, error} = new SystemLogger([blue(`[commands/${magenta('test')}]`)]);

export interface Options {
	_: string[]; // optional array of paths
	watch: boolean;
}
export type RequiredOptions = '_';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	watch: false,
	...omitUndefined(opts),
});

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {_: rawInputPaths} = options;

	const timings = new Timings<'total'>();
	timings.start('total');

	const inputPaths = resolveRawInputPaths(rawInputPaths);

	const testContext = new TestContext({report});

	// The test context needs to link its imported modules
	// to their execution context, so its API is a bit complex.
	// See the comment on `TestContext.beginImporting` for more.
	const finishImporting = testContext.beginImporting();
	const result = await loadModules(
		inputPaths,
		[TEST_FILE_SUFFIX],
		id => findFiles(id, file => isTestPath(file.path)),
		id => testContext.importModule(id),
	);
	finishImporting();
	if (!result.ok) {
		for (const reason of result.reasons) {
			error(reason);
		}
		return;
	}

	// The test modules register themselves with the testContext when imported,
	// so we don't pass them as a parameter to run them.
	// They're available as `result.modules` though.
	const testRunResult = await testContext.run();

	info(`${fmtMs(result.timings.get('map input paths'))} to map input paths`);
	info(`${fmtMs(result.timings.get('find files'))} to find files`);
	info(`${fmtMs(result.timings.get('load modules'))} to load modules`);
	// TODO this gets duplicated by the oki reporter
	info(`${fmtMs(testRunResult.timings.get('total'))} to run tests`);
	info(`🕒 ${fmtMs(timings.stop('total'))}`);
};
