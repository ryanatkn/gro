import type {Task} from './task/task.js';
import {copy} from './fs/nodeFs.js';
import {paths, toBuildOutPath} from './paths.js';
import {isTestBuildFile, isTestBuildArtifact} from './fs/testModule.js';
import {printPath} from './utils/print.js';
import {cleanDist} from './project/clean.js';
import {loadGroConfig} from './config/config.js';
import {configureLogLevel} from './utils/log.js';
import {printBuildConfig} from './config/buildConfig.js';

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);

export const task: Task = {
	description: 'create the distribution',
	run: async ({log}) => {
		const dev = process.env.NODE_ENV !== 'production';

		await cleanDist(log);

		// This reads the `dist` flag on the build configs to help construct the final dist directory.
		// See the docs at `./docs/config.md`.
		const config = await loadGroConfig();
		configureLogLevel(config.logLevel);
		const buildConfigsForDist = config.builds.filter((b) => b.dist);
		await Promise.all(
			buildConfigsForDist.map((buildConfig) => {
				const buildOutDir = toBuildOutPath(dev, buildConfig.name);
				const distOutDir =
					buildConfigsForDist.length === 1
						? paths.dist
						: `${paths.dist}${printBuildConfig(buildConfig)}`;
				log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
				return copy(buildOutDir, distOutDir, {filter: (id) => isDistFile(id)});
			}),
		);
	},
};
