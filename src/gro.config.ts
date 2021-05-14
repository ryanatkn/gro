import {createFilter} from '@rollup/pluginutils';

// import {createDirectoryFilter} from './build/utils.js';
import type {GroConfigCreator} from './config/config.js';
import {toBuildOutPath} from './paths.js';
import {ENV_LOG_LEVEL, LogLevel} from './utils/log.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

export const config: GroConfigCreator = async ({dev}) => {
	// TODO not this
	const ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
	const BROWSER_BUILD_NAME = 'browser';
	return {
		builds: [
			{
				name: 'node',
				platform: 'node',
				input: [
					'index.ts',
					'cli/gro.ts',
					'cli/invoke.ts',
					createFilter(['**/*.{task,test,config,gen,gen.*}.ts', '**/fixtures/**']),
				],
			},
			dev
				? null
				: {
						name: 'lib',
						platform: 'node',
						input: [
							'index.ts',
							'cli/gro.ts',
							'cli/invoke.ts',
							createFilter(['**/*.{task,config,config.default}.ts']),
						],
				  },
			{
				name: BROWSER_BUILD_NAME,
				platform: 'browser',
				input: ['client/index.ts', createFilter(`**/*.{${ASSET_PATHS.join(',')}}`)],
				// input: createDirectoryFilter('client'),
			},
		],
		sourcemap: dev,
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		serve: [
			// first try to fulfill requests with files in `$PROJECT/src/client/` as if it were `/`
			toBuildOutPath(true, BROWSER_BUILD_NAME, 'client'),
			// then look for files in `$PROJECT/src/`
			toBuildOutPath(true, BROWSER_BUILD_NAME, ''),
			// then.. no file found
		],
		// TODO maybe adapters should have flags for whether they run in dev or not? and allow overriding or something?
		adapt: async () =>
			Promise.all([
				(await import('./adapt/gro-adapter-node-library.js')).createAdapter({
					link: 'dist/cli/gro.js',
					builds: [{name: 'lib', type: 'unbundled'}],
				}),
			]),
	};
};
