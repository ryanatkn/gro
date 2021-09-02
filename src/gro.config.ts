import {createFilter} from '@rollup/pluginutils';
import {ENV_LOG_LEVEL, LogLevel} from '@feltcoop/felt/util/log.js';

import type {GroConfigCreator, GroConfigPartial} from 'src/config/config.js';
import {MAIN_TEST_PATH, toBuildOutPath} from './paths.js';
import {BROWSER_BUILD_NAME, NODE_LIBRARY_BUILD_CONFIG} from './build/buildConfigDefaults.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

export const config: GroConfigCreator = async ({dev}) => {
	// TODO not this
	const ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
	const enableBrowserBuild = dev;
	const partial: GroConfigPartial = {
		builds: [
			{
				...NODE_LIBRARY_BUILD_CONFIG,
				input: [
					'index.ts',
					MAIN_TEST_PATH,
					'cli/gro.ts',
					'cli/invoke.ts',
					'client/devtools.ts',
					'config/gro.config.default.ts',
					// TODO probably extract these to another repo, felt or gen utils or something
					'gen/helpers/html.ts',
					'gen/helpers/ts.ts',
					createFilter(['**/*.task.ts']),
				],
			},
			// the Gro browser build is currently an internal experiment
			enableBrowserBuild
				? {
						name: BROWSER_BUILD_NAME,
						platform: 'browser',
						input: ['client/index.ts', createFilter(`**/*.{${ASSET_PATHS.join(',')}}`)],
				  }
				: null,
		],
		publish: '.',
		sourcemap: dev,
		typemap: !dev,
		types: !dev,
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		serve: [
			// first try to fulfill requests with files in `$PROJECT/src/client/` as if it were `/`
			toBuildOutPath(true, BROWSER_BUILD_NAME, 'client'),
			// then look for files in `$PROJECT/src/`
			toBuildOutPath(true, BROWSER_BUILD_NAME, ''),
			// then.. no file found
		],
		plugin: async () => [
			enableBrowserBuild ? (await import('./plugin/groPluginDevServer.js')).createPlugin() : null,
		],
		// TODO maybe adapters should have flags for whether they run in dev or not? and allow overriding or something?
		adapt: async () =>
			Promise.all([
				(await import('./adapt/groAdapterNodeLibrary.js')).createAdapter({
					dir: 'dist',
					// TODO temp hack - unlike most libraries, Gro ships its dist/ as a sibling to src/,
					// and this flag opts out of the default library behavior
					pack: false,
					libraryRebasePath: '',
				}),
			]),
	};
	return partial;
};
