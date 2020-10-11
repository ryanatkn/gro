import {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {createDevServer} from './devServer/devServer.js';
import {createDefaultCompiler} from './compile/defaultCompiler.js';
import {paths, toBuildOutDir} from './paths.js';
import {loadBuildConfigs, loadPrimaryBuildConfig} from './build/buildConfig.js';
import {loadTsconfig, toEcmaScriptTarget} from './compile/tsHelpers.js';

export const task: Task = {
	description: 'start development server',
	run: async ({log}): Promise<void> => {
		const buildConfigs = await loadBuildConfigs();
		const primaryBuildConfig = await loadPrimaryBuildConfig();
		const buildConfigToServe =
			primaryBuildConfig.platform === 'browser'
				? primaryBuildConfig
				: buildConfigs.find((c) => c.platform === 'browser') || primaryBuildConfig;
		const buildOutDirToServe = toBuildOutDir(true, buildConfigToServe.name, '');

		const tsconfig = loadTsconfig(log);
		const target = toEcmaScriptTarget(tsconfig.compilerOptions?.target);
		const sourceMap = tsconfig.compilerOptions?.sourceMap ?? true;

		const filer = new Filer({
			compiler: createDefaultCompiler(),
			compiledDirs: [paths.source],
			servedDirs: [buildOutDirToServe],
			buildConfigs,
			target,
			sourceMap,
		});

		const devServer = createDevServer({filer});

		await Promise.all([filer.init(), devServer.start()]);
	},
};
