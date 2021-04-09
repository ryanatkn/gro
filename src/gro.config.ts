import {createFilter} from '@rollup/pluginutils';

// import {createDirectoryFilter} from './build/utils.js';
import type {GroConfigCreator, GroConfigPartial} from './config/config.js';
import {toBuildOutPath} from './paths.js';
import {ENV_LOG_LEVEL, LogLevel} from './utils/log.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

export const config: GroConfigCreator = async () => {
	const ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
	const BROWSER_BUILD_CONFIG_NAME = 'browser';
	const config: GroConfigPartial = {
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
	};
	return config;
};
