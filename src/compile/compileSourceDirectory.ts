import {spawnProcess} from '../utils/process.js';
import {printMs, printTiming} from '../utils/print.js';
import {Logger} from '../utils/log.js';
import {createStopwatch, Timings} from '../utils/time.js';
import {paths, TS_EXTENSION} from '../paths.js';
import {Filer} from '../fs/Filer.js';
import {createDefaultCompiler} from './defaultCompiler.js';
import {BuildConfig} from '../build/buildConfig.js';
import {cleanProductionBuild} from '../project/clean.js';

export const compileSourceDirectory = async (
	buildConfigs: BuildConfig[],
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.info('compiling...');

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
		log.info(`🕒 compiled in ${printMs(totalTiming())}`);
	};

	let include: ((id: string) => boolean) | undefined = dev
		? undefined
		: (id) => !id.endsWith(TS_EXTENSION);

	if (!dev) {
		await cleanProductionBuild(log);
	}

	const timingToCreateFiler = timings.start('create filer');
	const filer = new Filer({
		compiler: createDefaultCompiler(),
		compiledDirs: [paths.source],
		buildConfigs,
		watch: false,
		include,
		dev,
	});
	timingToCreateFiler();

	const timingToInitFiler = timings.start('init filer');
	await filer.init();
	timingToInitFiler();

	filer.close();

	// tsc needs to be invoked after the Filer is done, or else the Filer deletes its output!
	if (!dev) {
		const timingToCompileWithTsc = timings.start('compile with tsc');
		await spawnProcess('node_modules/.bin/tsc'); // ignore compiler errors
		timingToCompileWithTsc();
	}

	logTimings();
};
