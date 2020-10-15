import {copy} from './fs/nodeFs.js';
import {Task} from './task/task.js';
import {paths, toBuildOutDir} from './paths.js';
import {isTestBuildFile, isTestBuildArtifact} from './oki/testModule.js';
import {printPath} from './utils/print.js';
import {cleanDist} from './project/clean.js';
import {loadConfig} from './config/config.js';
import {findDistBuildConfigs} from './config/buildConfig.js';

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);

export const task: Task = {
	description: 'create the distribution',
	run: async ({log}) => {
		await cleanDist(log);

		// This reads the `dist` flag on the build configs to help construct the final dist directory.
		// See the docs at `./docs/config.md`.
		const dev = process.env.NODE_ENV === 'development';
		const config = await loadConfig();
		const buildConfigsForDist = findDistBuildConfigs(config);
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
