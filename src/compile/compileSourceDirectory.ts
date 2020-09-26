import {spawnProcess} from '../utils/process.js';
import {printMs, printTiming} from '../utils/print.js';
import {Logger} from '../utils/log.js';
import {createStopwatch, Timings} from '../utils/time.js';
import {TS_EXTENSION} from '../paths.js';
import {createCompiler} from './compiler.js';
import {FileCache} from '../fs/FileCache.js';

export const compileSourceDirectory = async (dev: boolean, log: Logger): Promise<void> => {
	log.info('compiling...');

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
		log.info(`🕒 compiled in ${printMs(totalTiming())}`);
	};

	let include: ((id: string) => boolean) | undefined = undefined;

	if (!dev) {
		const timingToCompileWithTsc = timings.start('compile with tsc');
		await spawnProcess('node_modules/.bin/tsc'); // ignore compiler errors
		timingToCompileWithTsc();
		include = (id: string) => !id.endsWith(TS_EXTENSION);
	}

	const timingToCreateFileCache = timings.start('create file cache');
	const fileCache = new FileCache({
		compiler: createCompiler({dev, log}),
		watch: false,
		include,
	});
	timingToCreateFileCache();

	const timingToInitFileCache = timings.start('init file cache');
	await fileCache.init();
	timingToInitFileCache();

	fileCache.destroy();

	logTimings();
};
