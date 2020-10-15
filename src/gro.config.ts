import {GroConfig, CreateGroConfig} from './project/config.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./project/gro.config.ts`.

export const createConfig: CreateGroConfig = async () => {
	const config: GroConfig = {
		buildConfigs: [{name: 'node', platform: 'node'}],
	};

	return config;
};
