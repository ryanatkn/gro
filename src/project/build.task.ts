import type {Task} from '../task/task.js';
import {printTiming} from '../utils/print.js';
import {spawnProcess} from '../utils/process.js';
import {Timings} from '../utils/time.js';
import {buildSourceDirectory} from '../build/buildSourceDirectory.js';
import {loadGroConfig} from '../config/config.js';
import {clean} from '../fs/clean.js';

export const task: Task = {
	description: 'build, create, and link the distribution',
	dev: false,
	run: async ({fs, dev, invokeTask, log}) => {
		const timings = new Timings();

		const timeToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(fs, dev);
		timeToLoadConfig();

		// build everything using the normal build process - js files will compiled again by `tsc` later
		const timingToBuildWithFiler = timings.start('build with filer');
		await buildSourceDirectory(fs, config, dev, log);
		timingToBuildWithFiler();

		await clean(fs, {dist: true}, log);

		// compile again with `tsc` to create all of the TypeScript type defs, sourcemaps, and typemaps
		const timingToCompileWithTsc = timings.start('compile with tsc');
		log.info('compiling with tsc');
		const tscResult = await spawnProcess('npx', ['tsc']);
		if (!tscResult.ok) throw Error(`TypeScript failed to compile with code ${tscResult.code}`);
		timingToCompileWithTsc();

		// create the dist
		const timingToCreateDist = timings.start('create dist');
		await invokeTask('project/dist');
		timingToCreateDist();

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
