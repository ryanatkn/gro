import type {Task, Args} from './task/task.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from './build/build.js';
import {DIST_DIR, SVELTE_KIT_APP_DIRNAME, SVELTE_KIT_BUILD_DIRNAME} from './paths.js';
import {Timings} from './utils/time.js';
import {loadGroConfig} from './config/config.js';
import type {GroConfig} from './config/config.js';
import {buildSourceDirectory} from './build/buildSourceDirectory.js';
import {SpawnedProcess, spawnProcess} from './utils/process.js';
import type {TaskEvents as ServerTaskEvents} from './server.task.js';
import {hasApiServerConfig, hasSvelteKitFrontend} from './config/defaultBuildConfig.js';
import {printTimings} from './utils/print.js';
import {clean} from './fs/clean.js';
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
	'build.buildSrc': void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	description: 'build the project',
	dev: false,
	run: async (ctx): Promise<void> => {
		const {fs, dev, log, args, invokeTask, events} = ctx;
		if (dev) {
			log.warn('building in development mode; normally this is only for diagnostics');
		}

		const timings = new Timings(); // TODO belongs in ctx

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
		const timingToBuildSrc = timings.start('buildSrc');
		await buildSourceDirectory(fs, config, dev, log);
		timingToBuildSrc();
		events.emit('build.buildSrc');

		// now that the sources are built, we can start the API server, if it exists
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

		// Adapt the build to final ouputs.
		const timingToAdapt = timings.start('adapt');
		const adaptContext: AdaptBuildsContext<TaskArgs, TaskEvents> = {...ctx, config};
		const adapters = await config.adapt(adaptContext);
		// this could be parallelized, but I think adapting one at a time is a better DX for now,
		// easier to follow what's happening (probably parallelize though, or maybe an option)
		for (const adapter of toArray(adapters)) {
			if (!adapter) continue;
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

		printTimings(timings, log);
	},
};
