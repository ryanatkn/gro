import {setupPublicEnv} from './publicEnv.js';

export const setupEnv = (env = process.env) => {
	setupPublicEnv(env);
};
