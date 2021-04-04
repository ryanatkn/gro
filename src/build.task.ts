import {pathExists} from './fs/nodeFs.js';
import type {Task} from './task/task.js';
import {createBuild} from './project/build.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from './project/build.js';
import {getDefaultEsbuildOptions} from './build/esbuildBuildHelpers.js';
import {isThisProjectGro, toBuildOutPath} from './paths.js';
import {Timings} from './utils/time.js';
import {loadGroConfig} from './config/config.js';
import type {GroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import type {BuildConfig} from './config/buildConfig.js';

export interface TaskArgs {
	watch?: boolean;
	mapInputOptions?: MapInputOptions;
	mapOutputOptions?: MapOutputOptions;
	mapWatchOptions?: MapWatchOptions;
}

export interface TaskEvents {
	'build.createConfig': (config: GroConfig) => void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	description: 'build the project',
	dev: false,
	run: async ({dev, log, args, invokeTask, events}): Promise<void> => {
		// Normal user projects will ignore this code path right here:
		// in other words, `isThisProjectGro` will always be `false` for your code.
		// TODO task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		if (isThisProjectGro) {
			return invokeTask('project/build');
		}

		const timings = new Timings();

		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}
		const watch = args.watch ?? false;
		const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(dev);
		configureLogLevel(config.logLevel);
		timingToLoadConfig();
		events.emit('build.createConfig', config);

		const esbuildOptions = getDefaultEsbuildOptions(config.target, config.sourcemap, dev);

		// Not every build config is built for the final `dist/`!
		// Only those that currently have `dist: true` are output.
		// This allows a project's `src/gro.config.ts`
		// to control the "last mile" each time `gro build` is run.
		const buildConfigsToBuild = config.builds.filter((buildConfig) => buildConfig.dist);
		// For each build config that has `dist: true`,
		// infer which of the inputs are actual source files,
		// and therefore belong in the default Rollup build.
		// If more customization is needed, users should implement their own `src/build.task.ts`,
		// which can be bootstrapped by copy/pasting this one. (and updating the imports)
		await Promise.all(
			buildConfigsToBuild.map(async (buildConfig) => {
				const inputFiles = await resolveInputFiles(buildConfig);
				log.info(`building "${buildConfig.name}"`, inputFiles);
				if (inputFiles.length) {
					const outputDir = toBuildOutPath(dev, buildConfig.name);
					const build = createBuild({
						dev,
						sourcemap: config.sourcemap,
						inputFiles,
						outputDir,
						watch,
						mapInputOptions,
						mapOutputOptions,
						mapWatchOptions,
						esbuildOptions,
					});
					await build.promise;
				} else {
					log.warn(`no input files in build "${buildConfig.name}"`);
				}
			}),
		);

		// ...
	},
};

// TODO use `resolveRawInputPaths`? consider the virtual fs - use the `Filer` probably
const resolveInputFiles = async (buildConfig: BuildConfig): Promise<string[]> =>
	(
		await Promise.all(
			buildConfig.input.map(async (input) =>
				typeof input === 'string' && (await pathExists(input)) ? input : null!,
			),
		)
	).filter(Boolean);
