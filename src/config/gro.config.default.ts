import {ENV_LOG_LEVEL, LogLevel} from '@feltcoop/felt/util/log.js';

import type {GroConfigCreator, GroConfigPartial} from 'src/config/config.js';
import {
	hasNodeLibrary,
	NODE_LIBRARY_BUILD_CONFIG,
	hasSveltekitFrontend,
	hasApiServer,
	API_SERVER_BUILD_CONFIG,
	hasGroFrontend,
	toDefaultBrowserBuild,
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
- if `src/index.html` and `src/index.ts`,
	assumes Gro's deprecated SPA mode - https://github.com/feltcoop/gro/issues/106

*/

export const config: GroConfigCreator = async ({fs, dev}) => {
	const [enableNodeLibrary, enableApiServer, enableSveltekitFrontend, enableGroFrontend] =
		await Promise.all([
			hasNodeLibrary(fs),
			hasApiServer(fs),
			hasSveltekitFrontend(fs),
			hasGroFrontend(fs),
		]);
	const enableDevServer = dev && enableGroFrontend;
	const partial: GroConfigPartial = {
		builds: [
			enableNodeLibrary ? NODE_LIBRARY_BUILD_CONFIG : null,
			enableApiServer ? API_SERVER_BUILD_CONFIG : null,
			// note there's no build for SvelteKit frontends - should there be?
			enableGroFrontend ? toDefaultBrowserBuild() : null, // TODO configure asset paths
		],
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		types: enableNodeLibrary,
		plugin: async () => [
			enableDevServer ? (await import('../plugin/groPluginDevServer.js')).createPlugin() : null,
			enableApiServer ? (await import('../plugin/groPluginApiServer.js')).createPlugin() : null,
			enableSveltekitFrontend
				? (await import('../plugin/groPluginSveltekitFrontend.js')).createPlugin()
				: null,
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
			enableGroFrontend
				? (await import('../adapt/groAdapterGroFrontend.js')).createAdapter()
				: null,
			enableSveltekitFrontend
				? (await import('../adapt/groAdapterSveltekitFrontend.js')).createAdapter()
				: null,
		],
	};
	return partial;
};
