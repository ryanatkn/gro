import {createFilter} from '@rollup/pluginutils';

import {basePathToSourceId} from '../paths.js';
import {GroConfigCreator, PartialGroConfig} from './config.js';

// This is the default config that's used if the current project does not define one.

const createConfig: GroConfigCreator = async () => {
	const config: PartialGroConfig = {
		// TODO include only tasks and such in the Node build,
		// and follow imports from entry points in the browser build so things like tasks aren't included
		builds: [
			{name: 'browser', platform: 'browser', dist: true},
			{
				name: 'node',
				platform: 'node',
				include: createFilter(undefined, basePathToSourceId('**/*.svelte')),
			},
		],
	};

	return config;
};

export default createConfig;
