import type {GroConfigCreator, GroConfigPartial} from './config.js';
import {ENV_LOG_LEVEL, LogLevel} from '../utils/log.js';
import {
	hasDeprecatedGroFrontend,
	hasApiServer,
	hasNodeLibrary,
	PRIMARY_NODE_BUILD_CONFIG,
	API_SERVER_BUILD_CONFIG,
	toDefaultBrowserBuild,
	NODE_LIBRARY_BUILD_CONFIG,
} from './defaultBuildConfig.js';

/*

This is the default config that's used
if the current project does not define one at `src/gro.config.ts`.
It looks at the project and tries to do the right thing:

- if `src/index.html` and `src/index.ts`,
	assumes Gro's deprecated SPA mode - https://github.com/feltcoop/gro/issues/106
- if `src/index.ts` and not `src/index.html`,
	assumes a Node library
- if `src/server/server.ts`,
	assumes a Node API server

*/

export const config: GroConfigCreator = async ({fs}) => {
	const [enableGroFrontend, enableNodeLibrary, enableApiServer] = await Promise.all([
		hasDeprecatedGroFrontend(fs),
		hasNodeLibrary(fs),
		hasApiServer(fs),
	]);
	const partial: GroConfigPartial = {
		builds: [
			PRIMARY_NODE_BUILD_CONFIG,
			enableGroFrontend ? toDefaultBrowserBuild() : null, // TODO configure asset paths
			enableNodeLibrary ? NODE_LIBRARY_BUILD_CONFIG : null,
			enableApiServer ? API_SERVER_BUILD_CONFIG : null,
		],
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		// TODO should this use `defaultAdapt`? might be different?
		adapt: async () => {
			return [
				// TODO
				// enableApiServer ? (await import('./gro-adapter-api-server.js')).createAdapter() : null,
				enableGroFrontend ? (await import('./gro-adapter-spa-frontend.js')).createAdapter() : null,
				enableNodeLibrary ? (await import('./gro-adapter-node-library.js')).createAdapter() : null,
			];
		},
	};
	return partial;
};
