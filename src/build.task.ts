import {pathExists} from './fs/nodeFs.js';
import type {Task} from './task/task.js';
import {createBuild} from './project/build.js';
import {getDefaultEsbuildOptions} from './build/esbuildBuildHelpers.js';
import {loadTsconfig, toEcmaScriptTarget} from './build/tsBuildHelpers.js';
import {isThisProjectGro, toBuildOutPath} from './paths.js';
import {Timings} from './utils/time.js';
import {loadGroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import type {BuildConfig} from './config/buildConfig.js';

process.env.NODE_ENV = 'production';
const dev = false; // forcing prod builds for now

export const task: Task = {
	description: 'build the project',
	run: async ({log, args, invokeTask}): Promise<void> => {
		// Normal user projects will ignore this code path right here:
		// in other words, `isThisProjectGro` will always be `false` for your code.
		// TODO bad task pollution, this is bad for users who want to copy/paste this task.
		// think of a better way - maybe config+defaults?
		if (isThisProjectGro) {
			return invokeTask('project/build');
		}

		const timings = new Timings();

		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}
		const watch: boolean = (args.watch as any) || false;
		const mapInputOptions = args.mapInputOptions as any;
		const mapOutputOptions = args.mapOutputOptions as any;
		const mapWatchOptions = args.mapWatchOptions as any;

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig();
		configureLogLevel(config.logLevel);
		timingToLoadConfig();
		args.oncreateconfig && (args as any).oncreateconfig(config);

		// TODO this is outdated - needs to be updated with the Gro config (see `dev.task.ts`)
		const tsconfigPath = undefined; // TODO parameterized options?
		const basePath = undefined; // TODO parameterized options?
		const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
		const target = toEcmaScriptTarget(tsconfig.compilerOptions?.target);
		const sourcemap = tsconfig.compilerOptions?.sourceMap ?? true;
		const esbuildOptions = getDefaultEsbuildOptions(target, sourcemap);

		// For each build config, infer which of the inputs
		// are actual source files, and therefore belong in the default Rollup build.
		// If more customization is needed, users should implement their own `src/build.task.ts`,
		// which can be bootstrapped by copy/pasting this one. (and updating the imports)
		await Promise.all(
			config.builds.map(async (buildConfig) => {
				const inputFiles = await resolveInputFiles(buildConfig);
				log.info(`building "${buildConfig.name}"`, inputFiles);
				if (inputFiles.length) {
					const outputDir = toBuildOutPath(dev, buildConfig.name);
					const build = createBuild({
						dev,
						sourcemap,
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
