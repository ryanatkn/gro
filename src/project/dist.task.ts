import type {Task} from '../task/task.js';
import {copy} from '../fs/node.js';
import {paths, toBuildOutPath} from '../paths.js';
import {isTestBuildFile, isTestBuildArtifact} from '../fs/testModule.js';
import {printPath} from '../utils/print.js';
import {loadGroConfig} from '../config/config.js';
import {printBuildConfig} from '../config/buildConfig.js';

export const task: Task = {
	description: 'create and link the distribution',
	dev: false,
	run: async ({invokeTask, dev, log}) => {
		// This reads the `dist` flag on the build configs to help construct the final dist directory.
		// See the docs at `./docs/config.md`.
		const config = await loadGroConfig(dev);
		const buildConfigsForDist = config.builds.filter((b) => b.dist);
		await Promise.all(
			buildConfigsForDist.map((buildConfig) => {
				const buildOutDir = toBuildOutPath(dev, buildConfig.name);
				const distOutDir =
					buildConfigsForDist.length === 1
						? paths.dist
						: `${paths.dist}${printBuildConfig(buildConfig)}`;
				log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
				return copy(buildOutDir, distOutDir, {
					overwrite: false, // let the TypeScript output take priority, but allow other files like Svelte
					filter: (id) => isDistFile(id),
				});
			}),
		);

		await invokeTask('project/link');
	},
};

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);
