const NODE_ENVS = ['development', 'production'];

export const setupPublicEnv = (env: {[key: string]: string | undefined}) => {
	if (!env.NODE_ENV) {
		env.NODE_ENV = 'development';
	} else if (!NODE_ENVS.includes(env.NODE_ENV)) {
		throw Error(`Unknown NODE_ENV "${env.NODE_ENV}"`);
	}
};
