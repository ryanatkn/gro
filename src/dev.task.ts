import {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {createDevServer} from './devServer/devServer.js';
import {createDefaultCompiler} from './compile/defaultCompiler.js';
import {paths, toBuildOutDir} from './paths.js';
import {loadTsconfig, toEcmaScriptTarget} from './compile/tsHelpers.js';
import {loadConfig} from './config/config.js';
import {findPrimaryBuildConfig} from './config/buildConfig.js';

export const task: Task = {
	description: 'start development server',
	run: async ({log}): Promise<void> => {
		const config = await loadConfig();
		const primaryBuildConfig = await findPrimaryBuildConfig(config);
		// TODO should this be `findServedBuildConfig`? or should this be a property on the config itself?
		// maybe that gets added by a normalization step?
		const buildConfigToServe =
			primaryBuildConfig.platform === 'browser'
				? primaryBuildConfig
				: config.builds.find((c) => c.platform === 'browser') || primaryBuildConfig;
		const buildOutDirToServe = toBuildOutDir(true, buildConfigToServe.name, '');

		// TODO probably replace these with the Gro config values
		// maybe the default config reads these from tsconfig?
		const tsconfig = loadTsconfig(log);
		const target = toEcmaScriptTarget(tsconfig.compilerOptions?.target);
		const sourceMap = tsconfig.compilerOptions?.sourceMap ?? true;

		const filer = new Filer({
			compiler: createDefaultCompiler(),
			compiledDirs: [paths.source],
			servedDirs: [buildOutDirToServe],
			buildConfigs: config.builds,
			target,
			sourceMap,
		});

		const devServer = createDevServer({filer});

		await Promise.all([filer.init(), devServer.start()]);
	},
};
