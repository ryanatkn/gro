import {createFilter} from '@rollup/pluginutils';

import {GroConfigCreator, PartialGroConfig} from './config.js';
import {basePathToSourceId} from '../paths.js';

// This is the default config that's used if the current project does not define one.

const createConfig: GroConfigCreator = async () => {
	const config: PartialGroConfig = {
		// TODO include only tasks and such in the Node build,
		// and follow imports from entry points in the browser build so things like tasks aren't included
		builds: [
			{
				name: 'browser',
				platform: 'browser',
				input: 'index.ts',
				dist: true,
			},
			{
				name: 'node',
				platform: 'node',
				// TODO should this be a pattern/filter for all tasks? add in other subexts like `gen` and `test` too?
				// input: ['**/*.task.ts'],
				// input: [createFilter('**/*.task.ts')],
				input: '.',
				include: createFilter(undefined, basePathToSourceId('**/*.svelte')),
			},
		],
	};

	return config;
};

export default createConfig;
