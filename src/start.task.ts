import type {Task} from './task/task.js';
import {pathExists} from './fs/node.js';
import {Timings} from './utils/time.js';
import {DIST_DIRNAME, paths, sourceIdToBasePath, toBuildExtension} from './paths.js';
import type {GroConfig} from './config/config.js';
import {loadGroConfig} from './config/config.js';
import {spawn} from './utils/process.js';
import type {SpawnedProcess} from './utils/process.js';
import {green} from './utils/terminal.js';
import type {BuildConfig} from './config/buildConfig.js';
import {printTiming} from './utils/print.js';
import {resolveInputFiles} from './build/utils.js';
import {hasApiServer, hasSvelteKitFrontend} from './config/defaultBuildConfig.js';
import type {TaskArgs as ServeTaskArgs} from './serve.task.js';
import {toSvelteKitBasePath} from './build/sveltekit.js';
import {loadPackageJson} from './project/packageJson.js';

export interface TaskArgs extends ServeTaskArgs {}

export interface TaskEvents {
	'start.spawned': (spawneds: SpawnedProcess[], config: GroConfig) => void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	description: 'runs the dist/ builds for production',
	dev: false,
	run: async ({log, invokeTask, dev, events, args}) => {
		const timings = new Timings();

		// build if needed
		if (!(await pathExists(paths.dist))) {
			log.info(green('dist not detected; building'));
			const timingToBuild = timings.start('build');
			await invokeTask('build');
			timingToBuild();
		}

		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(dev);
		timingToLoadConfig();

		// detect if we're in a SvelteKit project, and prefer that to Gro's system for now
		if ((await hasSvelteKitFrontend()) && !(await hasApiServer())) {
			// `svelte-kit start` is not respecting the `svelte.config.cjs` property `paths.base`,
			// so we serve up the dist ourselves. we were going to anyway, if we're being honest
			args.serve = [
				{path: DIST_DIRNAME, base: dev ? '' : toSvelteKitBasePath(await loadPackageJson(), dev)},
			];
			// TODO set port to 3000 or whatever it should be
			await invokeTask('serve');
		} else {
			const inputs: {
				buildConfig: BuildConfig;
				inputFile: string;
			}[] = (
				await Promise.all(
					// TODO this needs to be changed, might need to configure on each `buildConfig`
					// maybe `dist: ['/path/to']` or `dist: {'/path/to': ...}`
					config.builds.map(async (buildConfig) =>
						(await resolveInputFiles(buildConfig)).map((inputFile) => ({buildConfig, inputFile})),
					),
				)
			).flat();
			const spawneds: SpawnedProcess[] = inputs
				.map((input) => {
					if (!input.buildConfig.dist) return null!;
					const path = toEntryPath(input.buildConfig);
					if (!path) {
						log.error('expected to find entry path for build config', input.buildConfig);
						return null!;
					}
					return spawn('node', [path]);
				})
				.filter(Boolean);
			events.emit('start.spawned', spawneds, config);
		}
		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};

// TODO where does this utility belong?
const toEntryPath = (buildConfig: BuildConfig): string | null => {
	// TODO this just looks for the first one - need better control, if this pattern is stabilized
	const sourceId = buildConfig.input.find((input) => typeof input === 'string') as
		| string
		| undefined;
	if (!sourceId) return null;
	return `${paths.dist}${toBuildExtension(sourceIdToBasePath(sourceId))}`;
};
