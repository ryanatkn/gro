import {pathExists} from './fs/nodeFs.js';
import type {Task} from './task/task.js';
import {createBuild} from './project/build.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from './project/build.js';
import {getDefaultEsbuildOptions} from './build/esbuildBuildHelpers.js';
import {isThisProjectGro, paths} from './paths.js';
import {Timings} from './utils/time.js';
import {loadGroConfig} from './config/config.js';
import type {GroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import type {BuildConfig} from './config/buildConfig.js';
import {buildSourceDirectory} from './build/buildSourceDirectory.js';
import type {SpawnedProcess} from './utils/process.js';
import type {TaskEvents as ServerTaskEvents} from './server.task.js';
import {hasGroServer} from './config/defaultBuildConfig.js';

export interface TaskArgs {
	mapInputOptions?: MapInputOptions;
	mapOutputOptions?: MapOutputOptions;
	mapWatchOptions?: MapWatchOptions;
	closeApiServer?: (spawned: SpawnedProcess) => Promise<void>; // let other tasks hang onto the api server
}

export interface TaskEvents extends ServerTaskEvents {
	'build.createConfig': (config: GroConfig) => void;
	'build.prebuild': void;
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
		const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(dev);
		configureLogLevel(config.logLevel);
		timingToLoadConfig();
		events.emit('build.createConfig', config);

		const esbuildOptions = getDefaultEsbuildOptions(config.target, config.sourcemap, dev);

		// TODO think this through
		// This is like a "prebuild" phase.
		// Build everything with esbuild and Gro's `Filer` first,
		// so we have the production server available to run while SvelteKit is building.
		// See the other reference to `isThisProjectGro` for comments about its weirdness.
		let spawnedApiServer: SpawnedProcess | null = null;
		if (!isThisProjectGro) {
			await buildSourceDirectory(config, dev, log);
			events.emit('build.prebuild');

			// now that the prebuild is ready, we can start the API server, if it exists
			if (await hasGroServer()) {
				events.once('server.spawn', (spawned) => {
					spawnedApiServer = spawned;
				});
				// TODO still broken
				// await invokeTask('server', undefined, undefined, true);
				await invokeTask('server');
			}
		}

		// Not every build config is built for the final `dist/`!
		// Only those that currently have `dist: true` are output.
		// This allows a project's `src/gro.config.ts`
		// to control the "last mile" each time `gro build` is run.
		// TODO maybe assign these to the `config` above?
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
					const build = createBuild({
						dev,
						sourcemap: config.sourcemap,
						inputFiles,
						outputDir: paths.dist,
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

		// done! clean up the API server
		if (spawnedApiServer) {
			if (args.closeApiServer) {
				// don't await - whoever attached `closeApiServer` will clean it up
				args.closeApiServer(spawnedApiServer);
			} else {
				spawnedApiServer!.child.kill();
				await spawnedApiServer!.closed;
			}
		}
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
