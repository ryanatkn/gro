import {spawnProcess} from '../utils/process.js';
import {printMs, printTiming} from '../utils/print.js';
import {Logger} from '../utils/log.js';
import {createStopwatch, Timings} from '../utils/time.js';
import {paths} from '../paths.js';
import {Filer} from '../build/Filer.js';
import {createDefaultBuilder} from './defaultBuilder.js';
import {GroConfig} from '../config/config.js';
import {cleanProductionBuild} from '../project/clean.js';

export const buildSourceDirectory = async (
	config: GroConfig,
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.info('building source directory');

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
		log.info(`🕒 built in ${printMs(totalTiming())}`);
	};

	if (!dev) {
		await cleanProductionBuild(log);
	}

	const timingToCreateFiler = timings.start('create filer');
	const filer = new Filer({
		builder: createDefaultBuilder(),
		sourceDirs: [paths.source],
		buildConfigs: config.builds,
		watch: false,
		target: config.target,
		sourcemap: config.sourcemap,
		dev,
	});
	timingToCreateFiler();

	const timingToInitFiler = timings.start('init filer');
	await filer.init();
	timingToInitFiler();

	filer.close();

	// we need to compile the prod build after the Filer is done, or else the Filer deletes its output!
	if (!dev) {
		const timingToCompile = timings.start('compile with tsc');
		log.info('compiling TypeScript');
		await spawnProcess('npx', ['tsc']);
		timingToCompile();
	}

	logTimings();
};
