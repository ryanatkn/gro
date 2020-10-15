import {GroConfig, CreateGroConfig} from './config.js';

// This is the default config that's used if one cannot be found for the current project.

export const createConfig: CreateGroConfig = async () => {
	const config: GroConfig = {
		buildConfigs: [{name: 'browser', platform: 'browser'}],
	};

	return config;
};
