import {createFilter} from '@rollup/pluginutils';

import {GroConfigCreator, PartialGroConfig} from './config.js';

// This is the default config that's used if the current project does not define one.

const createConfig: GroConfigCreator = async () => {
	const config: PartialGroConfig = {
		builds: [
			{
				name: 'browser',
				platform: 'browser',
				input: ['index.ts', (id) => id.endsWith('.html') || id.endsWith('.css')],
				dist: true,
			},
			{
				name: 'node',
				platform: 'node',
				input: [createFilter('**/*.{task,test,config,gen}*.ts')],
			},
		],
	};

	return config;
};

export default createConfig;
