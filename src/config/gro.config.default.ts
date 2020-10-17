import {GroConfigCreator, PartialGroConfig} from './config.js';

// This is the default config that's used if the current project does not define one.

const createConfig: GroConfigCreator = async () => {
	const config: PartialGroConfig = {
		builds: [{name: 'browser', platform: 'browser'}],
	};

	return config;
};

export default createConfig;
