import {createFilter} from '@rollup/pluginutils';

import {GroConfigCreator, PartialGroConfig} from './config/config.js';
import {basePathToSourceId} from './paths.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

const createConfig: GroConfigCreator = async () => {
	const config: PartialGroConfig = {
		builds: [
			{
				name: 'node',
				platform: 'node',
				dist: true,
				primary: true,
				include: createFilter(undefined, basePathToSourceId('frontend/**/*')),
			},
			{
				name: 'browser',
				platform: 'browser',
				include: createFilter(basePathToSourceId('frontend/**/*')),
			},
		],
	};

	return config;
};

export default createConfig;
