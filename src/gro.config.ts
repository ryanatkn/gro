import {createFilter} from '@rollup/pluginutils';
import {ENV_LOG_LEVEL, Log_Level} from '@feltcoop/felt/util/log.js';

// import {createDirectoryFilter} from './build/utils.js';
import type {Gro_Config_Creator, Gro_Config_Partial} from './config/config.js';
import {to_build_out_path} from './paths.js';
import {BROWSER_BUILD_NAME, NODE_LIBRARY_BUILD_CONFIG} from './build/default_build_config.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

export const config: Gro_Config_Creator = async ({dev}) => {
	// TODO not this
	const ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
	const partial: Gro_Config_Partial = {
		builds: [
			{
				...NODE_LIBRARY_BUILD_CONFIG,
				input: [
					'index.ts',
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
			dev
				? {
						name: BROWSER_BUILD_NAME,
						platform: 'browser',
						input: ['client/index.ts', createFilter(`**/*.{${ASSET_PATHS.join(',')}}`)],
						// input: createDirectoryFilter('client'),
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
		// TODO maybe adapters should have flags for whether they run in dev or not? and allow overriding or something?
		adapt: async () =>
			Promise.all([
				(await import('./adapt/gro-adapter-node-library.js')).create_adapter({
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
