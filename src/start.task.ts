import type {Task} from './task/task.js';
import {pathExists} from './fs/nodeFs.js';
import {Timings} from './utils/time.js';
import {paths, sourceIdToBasePath, toBuildExtension} from './paths.js';
import type {GroConfig} from './config/config.js';
import {loadGroConfig} from './config/config.js';
import {spawn} from './utils/process.js';
import type {SpawnedProcess} from './utils/process.js';
import {green} from './utils/terminal.js';
import type {BuildConfig} from './config/buildConfig.js';
import {printTiming} from './utils/print.js';

export interface TaskEvents {
	'start.spawned': (spawneds: SpawnedProcess[], config: GroConfig) => void;
}

export const task: Task<{}, TaskEvents> = {
	description: 'runs the dist/ builds for production',
	dev: false,
	run: async ({log, invokeTask, dev, events}) => {
		const timings = new Timings();
		if (!(await pathExists(paths.dist))) {
			log.info(green('dist not detected; building'));
			const timingToBuild = timings.start('build');
			await invokeTask('build');
			timingToBuild();
		}
		const timingToLoadConfig = timings.start('load config');
		const config = await loadGroConfig(dev);
		timingToLoadConfig();
		const spawneds: SpawnedProcess[] = config.builds
			.map((buildConfig) => {
				if (!buildConfig.dist) return null!;
				const path = toEntryPath(buildConfig);
				console.log('entry path', path);
				if (!path) {
					// TODO is this an error? warning? hmm?
					log.error('unable to find path for build config', buildConfig);
					return null!;
				}
				return spawn('node', [path]);
			})
			.filter(Boolean);
		events.emit('start.spawned', spawneds, config);

		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
		}
	},
};

const toEntryPath = (buildConfig: BuildConfig): string | null => {
	// TODO this just looks for the first one - need better control, *if* this pattern is stabilized
	const sourceId = buildConfig.input.find((input) => typeof input === 'string') as
		| string
		| undefined;
	if (!sourceId) return null;
	console.log('sourceId', sourceId);
	return `${paths.dist}${toBuildExtension(sourceIdToBasePath(sourceId))}`;
};
