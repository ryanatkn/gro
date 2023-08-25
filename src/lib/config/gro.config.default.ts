import {Logger} from '@feltjs/util/log.js';

import type {GroConfigCreator, GroConfigPartial} from './config.js';
import {
	hasSveltekitFrontend,
	hasApiServer,
	API_SERVER_BUILD_CONFIG,
	hasNodeLibrary,
} from '../build/buildConfigDefaults.js';

/*

This is the default config that's passed to `src/gro.config.ts`
if it exists in the current project, and if not, this is the final config.
It looks at the project and tries to do the right thing:

- if `src/routes` and `src/app.html`, assumes a SvelteKit frontend
- if `src/lib/index.ts`, assumes a Node library
- if `src/lib/server/server.ts`, assumes a Node API server

*/

const config: GroConfigCreator = async ({fs, dev}) => {
	const [enableNodeLibrary, enableApiServer, enableSveltekitFrontend] = await Promise.all([
		hasNodeLibrary(fs),
		hasApiServer(fs),
		hasSveltekitFrontend(fs),
	]);
	const partial: GroConfigPartial = {
		builds: [
			enableApiServer ? API_SERVER_BUILD_CONFIG : null,
			// note there's no build for SvelteKit frontends - should there be?
		],
		logLevel: Logger.level,
		plugin: async () => [
			enableApiServer ? (await import('../plugin/gro-plugin-api-server.js')).createPlugin() : null,
			enableSveltekitFrontend
				? (await import('../plugin/gro-plugin-sveltekit-frontend.js')).createPlugin()
				: null,
			dev ? (await import('../plugin/gro-plugin-gen.js')).createPlugin() : null,
		],
		adapt: async () => [
			enableNodeLibrary
				? (await import('../adapt/gro-adapter-node-library.js')).createAdapter()
				: null,
			enableApiServer
				? (await import('../adapt/gro-adapter-generic-build.js')).createAdapter({
						buildName: API_SERVER_BUILD_CONFIG.name,
				  })
				: null,
			enableSveltekitFrontend
				? (await import('../adapt/gro-adapter-sveltekit-frontend.js')).createAdapter({
						hostTarget: enableApiServer ? 'node' : 'githubPages',
				  })
				: null,
		],
	};
	return partial;
};

export default config;
