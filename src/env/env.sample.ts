import {setupPublicEnv} from './publicEnv';

export const setupEnv = (env = process.env) => {
	setupPublicEnv(env);
};
