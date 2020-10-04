import {copy} from './fs/nodeFs.js';
import {Task} from './task/task.js';
import {paths, toBuildDir} from './paths.js';
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

		// This reads the `dist` flag on the build configs to help construct the final dist directory.
		// See the docs at `./project/buildConfig.md`.
		const dev = process.env.NODE_ENV === 'development';
		const buildConfigs = await loadBuildConfigs();
		const buildConfigsForDist = buildConfigs.some((c) => c.dist)
			? buildConfigs.filter((c) => c.dist)
			: buildConfigs;
		await Promise.all(
			buildConfigsForDist.map((buildConfig) => {
				const buildDir = toBuildDir(dev, buildConfig.name, '');
				const destDir =
					buildConfigsForDist.length === 1 ? paths.dist : `${paths.dist}${buildConfig.name}`;
				log.info(`copying ${printPath(buildDir)} to ${printPath(destDir)}`);
				return copy(buildDir, destDir, {filter: (id) => isDistFile(id)});
			}),
		);

		await invokeTask('assets');
	},
};
