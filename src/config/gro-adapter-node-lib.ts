import type {Adapter} from './adapt.js';
import {Timings} from '../utils/time.js';
import {printTimings} from '../utils/print.js';
import {printSpawnResult, spawnProcess} from '../utils/process.js';
import {clean} from '../fs/clean.js';
import {TaskError} from '../task/task.js';
import {copyDist} from '../build/dist.js';
import {paths, toBuildOutPath} from '../paths.js';
import {PRIMARY_NODE_BUILD_NAME} from './defaultBuildConfig.js';

// TODO name? is it actually specific to Node libs?

export interface Options {
	buildNames: readonly string[];
	link: string | null; // path to `npm link`
}

const DEFAULT_BUILD_NAMES: readonly string[] = [PRIMARY_NODE_BUILD_NAME];

export const createAdapter = (options?: Partial<Options>): Adapter => {
	const buildNames = options?.buildNames ?? DEFAULT_BUILD_NAMES;
	const link = options?.link ?? null;
	return {
		name: 'gro-adapter-node-lib',
		adapt: async ({config, fs, dev, log}) => {
			const timings = new Timings(); // TODO probably move to task context

			const buildConfigs = config.builds.filter((b) => buildNames.includes(b.name));

			await clean(fs, {dist: true}, log);

			// compile again with `tsc` to create all of the TypeScript type defs, sourcemaps, and typemaps
			const timingToCompileWithTsc = timings.start('compile with tsc');
			log.info('compiling with tsc'); // TODO change this api to have `timings` take a logger and replace this line with logging in `start` above
			await Promise.all(
				buildConfigs.map(async (buildConfig) => {
					const outDir = toBuildOutPath(dev, buildConfig.name);
					const tscResult = await spawnProcess('npx', [
						'tsc',
						'--outDir',
						outDir,
						'--rootDir',
						paths.source,
					]);
					if (!tscResult.ok)
						throw Error(`TypeScript failed to compile with code ${tscResult.code}`);
				}),
			);
			timingToCompileWithTsc();

			// TODO instead of copying dist blindly,
			// maybe we take an option to bundle certain entrypoints?
			// how to support commonjs+esm outputs cleanly?
			// // output esm to index.mjs
			// args.mapOutputOptions = (outputOptions) => {
			// 	return {...outputOptions, sourcemap: false};
			// };
			// await invokeTask('gro/build');
			// await fs.move('dist/index.js', 'TEMP.mjs'); // stash
			// // output commonjs to index.js
			// args.mapOutputOptions = (outputOptions) => {
			// 	return {...outputOptions, format: 'commonjs', sourcemap: false};
			// };
			// await invokeTask('gro/build');
			// await fs.move('TEMP.mjs', 'dist/index.mjs'); // unstash

			// copy the dist
			const timingToCopyDist = timings.start('copy dist');
			// This reads the `dist` flag on the build configs to help construct the final dist directory.
			// See the docs at `./docs/config.md`.
			await Promise.all(
				buildConfigs.map((buildConfig) => copyDist(fs, buildConfig, dev, buildNames.length, log)),
			);
			timingToCopyDist();

			// `npm link` if configured
			if (link) {
				const timingToNpmLink = timings.start('npm link');
				const chmodResult = await spawnProcess('chmod', ['+x', link]);
				if (!chmodResult.ok) log.error(`CLI chmod failed with code ${chmodResult.code}`);
				log.info(`linking`);
				const linkResult = await spawnProcess('npm', ['link']);
				if (!linkResult.ok) {
					throw new TaskError(`Failed to link. ${printSpawnResult(linkResult)}`);
				}
				timingToNpmLink();
			}

			printTimings(timings, log);
		},
	};
};
