import type {Task} from './task/task.js';
import {createBuild} from './project/build.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from './project/build.js';
import {getDefaultEsbuildOptions} from './build/esbuildBuildHelpers.js';
import {
	DIST_DIR,
	isThisProjectGro,
	sourceIdToBasePath,
	SVELTE_KIT_BUILD_DIRNAME,
	toBuildExtension,
} from './paths.js';
import {Timings} from './utils/time.js';
import {loadGroConfig} from './config/config.js';
import type {GroConfig} from './config/config.js';
import {buildSourceDirectory} from './build/buildSourceDirectory.js';
import {SpawnedProcess, spawnProcess} from './utils/process.js';
import type {TaskEvents as ServerTaskEvents} from './server.task.js';
import {hasApiServerConfig, hasSvelteKitFrontend} from './config/defaultBuildConfig.js';
import {printTiming} from './utils/print.js';
import {resolveInputFiles} from './build/utils.js';
import {toCommonBaseDir} from './utils/path.js';
import {clean} from './fs/clean.js';
import {move, pathExists, remove} from './fs/node.js';
import {printBuildConfigLabel} from './config/buildConfig.js';

// outputs build artifacts to dist/ using SvelteKit or Gro config

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
		timingToLoadConfig();
		events.emit('build.createConfig', config);

		const esbuildOptions = getDefaultEsbuildOptions(config.target, config.sourcemap, dev);

		const timingToClean = timings.start('clean');
		await clean({dist: true}, log);
		timingToClean();

		// If this is a SvelteKit frontend, for now, just build it and exit immediately.
		// TODO support merging SvelteKit and Gro builds (and then delete `felt-server`'s build task)
		if (await hasSvelteKitFrontend()) {
			const timingToBuildSvelteKit = timings.start('SvelteKit build');
			await spawnProcess('npx', ['svelte-kit', 'build']);
			// TODO remove this when SvelteKit has its duplicate build dir bug fixed
			// TODO take a look at its issues/codebase for fix
			if (
				(await pathExists(`${SVELTE_KIT_BUILD_DIRNAME}/_app`)) &&
				(await pathExists(`${SVELTE_KIT_BUILD_DIRNAME}/app`))
			) {
				await remove(`${SVELTE_KIT_BUILD_DIRNAME}/_app`);
			}
			await move(SVELTE_KIT_BUILD_DIRNAME, DIST_DIR);
			timingToBuildSvelteKit();
		}

		// TODO think this through
		// This is like a "prebuild" phase.
		// Build everything with esbuild and Gro's `Filer` first,
		// so we have the production server available to run while SvelteKit is building.
		// See the other reference to `isThisProjectGro` for comments about its weirdness.
		let spawnedApiServer: SpawnedProcess | null = null;
		if (!isThisProjectGro) {
			const timingToPrebuild = timings.start('prebuild');
			await buildSourceDirectory(config, dev, log);
			timingToPrebuild();
			events.emit('build.prebuild');

			// now that the prebuild is ready, we can start the API server, if it exists
			if (hasApiServerConfig(config.builds)) {
				events.once('server.spawn', (spawned) => {
					spawnedApiServer = spawned;
				});
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
		const timingToBuild = timings.start('build');
		await Promise.all(
			buildConfigsToBuild.map(async (buildConfig) => {
				const inputFiles = await resolveInputFiles(buildConfig);
				if (!inputFiles.length) {
					log.trace('no input files in', printBuildConfigLabel(buildConfig));
					return;
				}
				// TODO ok wait, does `outputDir` need to be at the output dir path?
				const outputDir = `${DIST_DIR}${toBuildExtension(
					sourceIdToBasePath(toCommonBaseDir(inputFiles)),
				)}`;
				// const outputDir = paths.dist;
				log.info('building', printBuildConfigLabel(buildConfig), outputDir, inputFiles);
				const build = createBuild({
					dev,
					sourcemap: config.sourcemap,
					inputFiles,
					outputDir,
					mapInputOptions,
					mapOutputOptions,
					mapWatchOptions,
					esbuildOptions,
				});
				await build.promise;
			}),
		);
		timingToBuild();

		// done! clean up the API server
		if (spawnedApiServer) {
			if (args.closeApiServer) {
				// don't await - whoever attached `closeApiServer` will clean it up
				args.closeApiServer(spawnedApiServer);
			} else {
				spawnedApiServer!.child.kill();
				const timingToCloseServer = timings.start('close server');
				await spawnedApiServer!.closed;
				timingToCloseServer();
			}
		}

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};
