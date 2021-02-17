import {createFilter} from '@rollup/pluginutils';
// import {createDirectoryFilter} from './build/utils.js';

import {GroConfigCreator, PartialGroConfig} from './config/config.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

const createConfig: GroConfigCreator = async () => {
	const assetPaths = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
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
				name: 'browser',
				platform: 'browser',
				input: ['frontend/index.ts', createFilter(`**/*.{${assetPaths.join(',')}}`)],
				// input: createDirectoryFilter('frontend'),
			},
		],
	};

	return config;
};

export default createConfig;
