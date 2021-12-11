import {ENV_LOG_LEVEL, LogLevel} from '@feltcoop/felt/util/log.js';

import type {GroConfigCreator, GroConfigPartial} from 'src/config/config.js';
import {
	hasNodeLibrary,
	NODE_LIBRARY_BUILD_CONFIG,
	hasSveltekitFrontend,
	hasApiServer,
	API_SERVER_BUILD_CONFIG,
} from '../build/buildConfigDefaults.js';

/*

This is the default config that's passed to `src/gro.config.ts`
if it exists in the current project, and if not, this is the final config.
It looks at the project and tries to do the right thing:

- if `src/routes` and `src/app.html`,
	assumes a SvelteKit frontend
- if `src/lib/index.ts`,
	assumes a Node library
- if `src/lib/server/server.ts`,
	assumes a Node API server

*/

export const config: GroConfigCreator = async ({fs, dev}) => {
	const [enableNodeLibrary, enableApiServer, enableSveltekitFrontend] = await Promise.all([
		hasNodeLibrary(fs),
		hasApiServer(fs),
		hasSveltekitFrontend(fs),
	]);
	const partial: GroConfigPartial = {
		builds: [
			enableNodeLibrary ? NODE_LIBRARY_BUILD_CONFIG : null,
			enableApiServer ? API_SERVER_BUILD_CONFIG : null,
			// note there's no build for SvelteKit frontends - should there be?
		],
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		types: enableNodeLibrary,
		plugin: async () => [
			// TODO dev server?
			// enableDevServer ? (await import('../plugin/groPluginDevServer.js')).createPlugin() : null,
			// TODO some usecases may need to run the API server during the build for e.g. prerendering,
			// but it's currently disabled because the adapter-node usecase has the production API server
			// depend on the middleware created later in the adapt step of the build
			enableApiServer && dev
				? (await import('../plugin/groPluginApiServer.js')).createPlugin()
				: null,
			enableSveltekitFrontend
				? (await import('../plugin/groPluginSveltekitFrontend.js')).createPlugin()
				: null,
			(await import('../plugin/groPluginGen.js')).createPlugin(),
		],
		adapt: async () => [
			enableNodeLibrary
				? (await import('../adapt/groAdapterNodeLibrary.js')).createAdapter()
				: null,
			enableApiServer
				? (await import('../adapt/groAdapterGenericBuild.js')).createAdapter({
						buildName: API_SERVER_BUILD_CONFIG.name,
				  })
				: null,
			enableSveltekitFrontend
				? (await import('../adapt/groAdapterSveltekitFrontend.js')).createAdapter({
						hostTarget: enableApiServer ? 'node' : 'githubPages',
				  })
				: null,
		],
	};
	return partial;
};
