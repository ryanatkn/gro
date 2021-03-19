import {Task} from '../task/task.js';
import {printTiming} from '../utils/print.js';
import {spawnProcess} from '../utils/process.js';
import {Timings} from '../utils/time.js';

export const task: Task = {
	description: 'build, create, and link the distribution',
	run: async ({invokeTask, args, log}) => {
		// TODO improve this - maybe this should be a global gro task flag?
		if (!args.D && !args.dev) {
			process.env.NODE_ENV = 'production';
		}

		log.info(`building for ${process.env.NODE_ENV}`);
		const timings = new Timings();

		// build everything using the normal build process - js files will compiled again by `tsc` later
		const timingToBuildWithFiler = timings.start('build with filer');
		await invokeTask('compile');
		timingToBuildWithFiler();

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
