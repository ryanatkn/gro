import {GroConfigCreator, PartialGroConfig} from './config/config.js';

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
			},
			{
				name: 'browser',
				platform: 'browser',
			},
		],
	};

	return config;
};

export default createConfig;
