import {copy} from './fs/nodeFs.js';
import {Task} from './task/task.js';
import {paths, toBuildOutDir} from './paths.js';
import {isTestBuildFile, isTestBuildArtifact} from './oki/testModule.js';
import {printPath} from './utils/print.js';
import {cleanDist} from './project/clean.js';
import {loadBuildConfigs} from './project/buildConfig.js';

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);

export const task: Task = {
	description: 'create the distribution',
	run: async ({log}) => {
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
				const buildOutDir = toBuildOutDir(dev, buildConfig.name);
				const distOutDir =
					buildConfigsForDist.length === 1 ? paths.dist : `${paths.dist}${buildConfig.name}`;
				log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
				return copy(buildOutDir, distOutDir, {filter: (id) => isDistFile(id)});
			}),
		);
	},
};
