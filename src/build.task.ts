import type {Task, Args} from './task/task.js';
import {createBuild} from './build/build.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from './build/build.js';
import {
	DIST_DIR,
	sourceIdToBasePath,
	SVELTE_KIT_APP_DIRNAME,
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
import {printBuildConfigLabel} from './config/buildConfig.js';
import {ensureEnd} from './utils/string.js';
import {clean} from './fs/clean.js';
import {copyDist} from './build/dist.js';
import {toArray} from './utils/array.js';
import type {AdaptBuildsContext} from './config/adapt.js';

// outputs build artifacts to dist/ using SvelteKit or Gro config

export interface TaskArgs extends Args {
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
	run: async (ctx): Promise<void> => {
		const {fs, dev, log, args, invokeTask, events} = ctx;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}

		const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(fs, dev);
		timingToLoadConfig();
		events.emit('build.createConfig', config);

		const timingToClean = timings.start('clean');
		await clean(fs, {dist: true}, log);
		timingToClean();

		// Build everything with esbuild and Gro's `Filer` first,
		// so we have the production server available to run while SvelteKit is building.
		let spawnedApiServer: SpawnedProcess | null = null;
		const timingToPrebuild = timings.start('prebuild');
		await buildSourceDirectory(fs, config, dev, log);
		timingToPrebuild();
		events.emit('build.prebuild');

		// now that the prebuild is ready, we can start the API server, if it exists
		if (hasApiServerConfig(config.builds)) {
			events.once('server.spawn', (spawned) => {
				spawnedApiServer = spawned;
			});
			await invokeTask('server');
		}

		// Handle any SvelteKit build.
		// TODO could parallelize this - currently puts all SvelteKit stuff first
		if (await hasSvelteKitFrontend(fs)) {
			const timingToBuildSvelteKit = timings.start('SvelteKit build');
			await spawnProcess('npx', ['svelte-kit', 'build']);
			// TODO remove this when SvelteKit has its duplicate build dir bug fixed
			// TODO take a look at its issues/codebase for fix
			if (
				(await fs.exists(`${SVELTE_KIT_BUILD_DIRNAME}/_${SVELTE_KIT_APP_DIRNAME}`)) &&
				(await fs.exists(`${SVELTE_KIT_BUILD_DIRNAME}/${SVELTE_KIT_APP_DIRNAME}`))
			) {
				await fs.remove(`${SVELTE_KIT_BUILD_DIRNAME}/_${SVELTE_KIT_APP_DIRNAME}`);
			}
			// TODO remove this when we implement something like `adapter-felt`
			// We implement the adapting Svelte server ourselves in production,
			// so this line deletes the default Node adapter server app file.
			// The Node adapter is convenient to keep in place, and we just adjust the final `dist/`.
			await fs.remove(`${SVELTE_KIT_BUILD_DIRNAME}/index.js`);
			await fs.move(SVELTE_KIT_BUILD_DIRNAME, DIST_DIR);
			timingToBuildSvelteKit();
		}

		// The SvelteKit part of the build is now complete.
		// It's in `dist/` waiting for any Gro builds to be written around it.
		// TODO refactor when we implement `adapter-felt`

		// TODO make this a customizable bundling step

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
		// TODO this should only happen when we opt into bundling - how is that defined?
		const distCount = config.builds.filter((b) => b.dist).length;
		await Promise.all(
			buildConfigsToBuild.map(async (buildConfig) => {
				const {files, filters} = await resolveInputFiles(fs, buildConfig);
				if (!files.length) {
					log.trace('no input files in', printBuildConfigLabel(buildConfig));
					return;
				}
				// TODO `files` needs to be mapped to production output files
				const outputDir = `${DIST_DIR}${toBuildExtension(
					sourceIdToBasePath(ensureEnd(toCommonBaseDir(files), '/')), // TODO refactor when fixing the trailing `/`
				)}`;
				log.info('building', printBuildConfigLabel(buildConfig), outputDir, files);
				const build = createBuild({
					dev,
					sourcemap: config.sourcemap,
					inputFiles: files,
					outputDir,
					mapInputOptions,
					mapOutputOptions,
					mapWatchOptions,
				});
				await build.promise;

				// TODO might need to be refactored, like `filters` should be `buildConfig.input`
				// copy static prod files into `dist/`
				await copyDist(fs, buildConfig, dev, distCount, log, filters);
			}),
		);
		timingToBuild();

		// Adapt the build to final ouputs.
		const timingToAdapt = timings.start('adapt');
		const adaptContext: AdaptBuildsContext<TaskArgs, TaskEvents> = {...ctx, config};
		const adapters = await config.adapt(adaptContext);
		// this could be parallelized, but I think adapting one at a time is a better DX for now,
		// easier to follow what's happening (probably parallelize though, or maybe an option)
		for (const adapter of toArray(adapters)) {
			const timing = timings.start(`adapt ${adapter.name}`);
			await adapter.adapt(adaptContext);
			timing();
		}
		timingToAdapt();

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
