import {createFilter} from '@rollup/pluginutils';

// import {createDirectoryFilter} from './build/utils.js';
import {GroConfigCreator, PartialGroConfig} from './config/config.js';
import {toBuildOutPath} from './paths.js';
import {LogLevel} from './utils/log.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

const createConfig: GroConfigCreator = async () => {
	const ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
	const BROWSER_BUILD_CONFIG_NAME = 'browser';
	const config: PartialGroConfig = {
		builds: [
			{
				name: 'node',
				platform: 'node',
				dist: true,
				primary: true,
				input: ['index.ts', createFilter(['**/*.{task,test,config,gen}*.ts', '**/fixtures/**'])],
			},
			{
				name: BROWSER_BUILD_CONFIG_NAME,
				platform: 'browser',
				input: ['client/index.ts', createFilter(`**/*.{${ASSET_PATHS.join(',')}}`)],
				// input: createDirectoryFilter('client'),
			},
		],
		logLevel: LogLevel.Trace,
		serve: [
			toBuildOutPath(true, BROWSER_BUILD_CONFIG_NAME, 'client'),
			toBuildOutPath(true, BROWSER_BUILD_CONFIG_NAME, ''),
		],
	};
	return config;
};

export default createConfig;
