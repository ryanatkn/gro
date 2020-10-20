import {createFilter} from '@rollup/pluginutils';

import {basePathToSourceId} from '../paths.js';
import {GroConfigCreator, PartialGroConfig} from './config.js';

// This is the default config that's used if the current project does not define one.

const createConfig: GroConfigCreator = async () => {
	const config: PartialGroConfig = {
		builds: [
			{name: 'browser', platform: 'browser', dist: true},
			{
				name: 'node',
				platform: 'node',
				include: createFilter(undefined, basePathToSourceId('**/*.svelte')),
			}, // TODO include only tasks and such
		],
	};

	return config;
};

export default createConfig;
