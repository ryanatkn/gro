import {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {createDevServer} from './devServer/devServer.js';
import {createDefaultCompiler} from './compile/defaultCompiler.js';
import {paths, toBuildOutDir} from './paths.js';
import {loadBuildConfigs, loadPrimaryBuildConfig} from './build/buildConfig.js';

export const task: Task = {
	description: 'start development server',
	run: async (): Promise<void> => {
		const buildConfigs = await loadBuildConfigs();
		const primaryBuildConfig = await loadPrimaryBuildConfig();
		const buildConfigToServe =
			primaryBuildConfig.platform === 'browser'
				? primaryBuildConfig
				: buildConfigs.find((c) => c.platform === 'browser') || primaryBuildConfig;
		const buildOutDirToServe = toBuildOutDir(true, buildConfigToServe.name, '');
		const filer = new Filer({
			compiler: createDefaultCompiler(),
			compiledDirs: [paths.source, paths.externals],
			servedDirs: [buildOutDirToServe, {dir: paths.externals, servedAt: paths.build}],
			buildConfigs,
		});

		const devServer = createDevServer({filer});

		await Promise.all([filer.init(), devServer.start()]);
	},
};
