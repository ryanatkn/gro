import type {Task} from '../task/task.js';
import {isTestBuildFile, isTestBuildArtifact} from '../fs/testModule.js';
import {loadGroConfig} from '../config/config.js';
import {spawnProcess} from '../utils/process.js';
import {copyDist} from '../build/dist.js';

export const task: Task = {
	description: 'create and link the distribution',
	dev: false,
	run: async ({fs, invokeTask, dev, log}) => {
		// This reads the `dist` flag on the build configs to help construct the final dist directory.
		// See the docs at `./docs/config.md`.
		const config = await loadGroConfig(fs, dev);
		const distCount = config.builds.filter((b) => b.dist).length;
		await Promise.all(
			config.builds.map((buildConfig) => copyDist(fs, buildConfig, dev, distCount, log)),
		);

		// TODO this fixes the npm 7 linking issue, but it probably should be fixed a different way.
		// Why is this needed here but not when we call `npm run bootstrap` and get esbuild outputs?
		const chmodResult = await spawnProcess('chmod', ['+x', 'dist/cli/gro.js']);
		if (!chmodResult.ok) log.error(`CLI chmod failed with code ${chmodResult.code}`);

		await invokeTask('project/link');
	},
};

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);
