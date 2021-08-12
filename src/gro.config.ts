import {createFilter} from '@rollup/pluginutils';
import {ENV_LOG_LEVEL, Log_Level} from '@feltcoop/felt/util/log.js';

import type {GroConfigCreator, GroConfigPartial} from 'src/config/config.js';
import {MAIN_TEST_PATH, to_build_out_path} from './paths.js';
import {BROWSER_BUILD_NAME, NODE_LIBRARY_BUILD_CONFIG} from './build/build_config_defaults.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

export const config: GroConfigCreator = async ({dev}) => {
	// TODO not this
	const ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
	const enable_browser_build = dev;
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
			enable_browser_build
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
		log_level: ENV_LOG_LEVEL ?? Log_Level.Trace,
		serve: [
			// first try to fulfill requests with files in `$PROJECT/src/client/` as if it were `/`
			to_build_out_path(true, BROWSER_BUILD_NAME, 'client'),
			// then look for files in `$PROJECT/src/`
			to_build_out_path(true, BROWSER_BUILD_NAME, ''),
			// then.. no file found
		],
		plugin: async () => [
			enable_browser_build
				? (await import('./plugin/gro_plugin_dev_server.js')).create_plugin()
				: null,
		],
		// TODO maybe adapters should have flags for whether they run in dev or not? and allow overriding or something?
		adapt: async () =>
			Promise.all([
				(await import('./adapt/gro_adapter_node_library.js')).create_adapter({
					dir: 'dist',
					// TODO temp hack - unlike most libraries, Gro ships its dist/ as a sibling to src/,
					// and this flag opts out of the default library behavior
					pack: false,
					library_rebase_path: '',
				}),
			]),
	};
	return partial;
};
