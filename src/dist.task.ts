import {copy} from './fs/nodeFs.js';
import {Task} from './task/task.js';
import {paths, toBuildDir, toBuildsDir} from './paths.js';
import {isTestBuildFile, isTestBuildArtifact} from './oki/testModule.js';
import {printPath} from './utils/print.js';
import {cleanDist} from './project/clean.js';
import {loadBuildConfigs} from './project/buildConfig.js';

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);

export const task: Task = {
	description: 'create the distribution',
	run: async ({log, invokeTask}) => {
		await cleanDist(log);

		// TODO this is a hacky heuristic to determine which builds should be copied to `./dist`.
		// What's the better way to do this? Maybe an optional flag on each build?
		// So if `dist: true` is on multiple builds, we keep the namespacing but otherwise elide it?
		// Should users be given more granular control in the config,
		// or should we encourage implementing custom `dist` tasks to do this instead?
		const buildConfigs = await loadBuildConfigs();
		const dev = process.env.NODE_ENV === 'development';
		const buildDir =
			buildConfigs.length === 1 ? toBuildDir(dev, buildConfigs[0].name, '') : toBuildsDir(dev);
		log.info(`copying ${printPath(buildDir)} to ${printPath(paths.dist)}`);
		await copy(buildDir, paths.dist, {
			filter: (id) => isDistFile(id),
		});

		await invokeTask('assets');
	},
};
