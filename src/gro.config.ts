import {createFilter} from '@rollup/pluginutils';

// import {createDirectoryFilter} from './build/utils.js';
import type {GroConfigCreator} from './config/config.js';
import {toBuildOutPath} from './paths.js';
import {ENV_LOG_LEVEL, LogLevel} from './utils/log.js';
import {Timings} from './utils/time.js';
import {printTimings} from './utils/print.js';
import {printSpawnResult, spawnProcess} from './utils/process.js';
import {clean} from './fs/clean.js';
import {copyDist} from './build/dist.js';
import {TaskError} from './task/task.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

export const config: GroConfigCreator = async () => {
	const ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
	const BROWSER_BUILD_CONFIG_NAME = 'browser';
	return {
		builds: [
			// TODO think about this
			// {...SERVER_BUILD_CONFIG, dist: false},
			{
				name: 'node',
				platform: 'node',
				dist: true,
				primary: true,
				input: [
					'index.ts',
					'cli/gro.ts',
					'cli/invoke.ts',
					createFilter(['**/*.{task,test,config,gen}*.ts', '**/fixtures/**']),
				],
			},
			{
				name: BROWSER_BUILD_CONFIG_NAME,
				platform: 'browser',
				input: ['client/index.ts', createFilter(`**/*.{${ASSET_PATHS.join(',')}}`)],
				// input: createDirectoryFilter('client'),
			},
		],
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		serve: [
			// first try to fulfill requests with files in `$PROJECT/src/client/` as if it were `/`
			toBuildOutPath(true, BROWSER_BUILD_CONFIG_NAME, 'client'),
			// then look for files in `$PROJECT/src/`
			toBuildOutPath(true, BROWSER_BUILD_CONFIG_NAME, ''),
			// then.. no file found
		],
		adapt: async ({config, log, fs, dev}) => {
			return [
				{
					name: 'gro-dist-adapter',
					adapt: async () => {
						const timings = new Timings(); // TODO probably move to task context

						await clean(fs, {dist: true}, log);

						// compile again with `tsc` to create all of the TypeScript type defs, sourcemaps, and typemaps
						const timingToCompileWithTsc = timings.start('compile with tsc');
						log.info('compiling with tsc');
						const tscResult = await spawnProcess('npx', ['tsc']);
						if (!tscResult.ok)
							throw Error(`TypeScript failed to compile with code ${tscResult.code}`);
						timingToCompileWithTsc();

						// create the dist
						const timingToCreateDist = timings.start('create dist');
						// This reads the `dist` flag on the build configs to help construct the final dist directory.
						// See the docs at `./docs/config.md`.
						const distCount = config.builds.filter((b) => b.dist).length;
						await Promise.all(
							config.builds.map((buildConfig) => copyDist(fs, buildConfig, dev, distCount, log)),
						);

						// TODO this fixes the npm 7 linking issue, but it probably should be fixed a different way.
						// Why is this needed here but not when we call `npm run bootstrap` and get esbuild outputs?
						const chmodResult = await spawnProcess('chmod', ['+x', 'dist/cli/gro.js']);
						if (!chmodResult.ok) log.error(`CLI chmod failed with code ${chmodResult.code}`);
						log.info(`linking`);
						const linkResult = await spawnProcess('npm', ['link']);
						if (!linkResult.ok) {
							throw new TaskError(`Failed to link. ${printSpawnResult(linkResult)}`);
						}
						timingToCreateDist();

						printTimings(timings, log);
					},
				},
			];
		},
	};
};
