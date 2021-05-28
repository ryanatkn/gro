import {ENV_LOG_LEVEL, LogLevel} from '@feltcoop/felt/dist/utils/log.js';

import type {GroConfigCreator, GroConfigPartial} from './config.js';
import {
	hasNodeLibrary,
	PRIMARY_NODE_BUILD_CONFIG,
	NODE_LIBRARY_BUILD_CONFIG,
	hasSvelteKitFrontend,
} from '../build/defaultBuildConfig.js';

/*

This is the default config that's used
if the current project does not define one at `src/gro.config.ts`.
It looks at the project and tries to do the right thing:

- if `src/routes` and `src/app.html`,
	assumes a SvelteKit frontend
- if `src/index.html` and `src/index.ts`,
	assumes Gro's deprecated SPA mode - https://github.com/feltcoop/gro/issues/106
- if `src/index.ts` and not `src/index.html`,
	assumes a Node library
- if `src/server/server.ts`,
	assumes a Node API server

*/

export const config: GroConfigCreator = async ({fs}) => {
	const [
		enableNodeLibrary,
		// enableApiServer,
		enableSvelteKitFrontend,
		// enableGroFrontend,
	] = await Promise.all([
		hasNodeLibrary(fs),
		// hasApiServer(fs),
		hasSvelteKitFrontend(fs),
		// hasDeprecatedGroFrontend(fs),
	]);
	const partial: GroConfigPartial = {
		builds: [
			PRIMARY_NODE_BUILD_CONFIG,
			enableNodeLibrary ? NODE_LIBRARY_BUILD_CONFIG : null,
			// enableApiServer ? API_SERVER_BUILD_CONFIG : null,
			// enableGroFrontend ? toDefaultBrowserBuild() : null, // TODO configure asset paths
			// note there's no build for SvelteKit frontends - should there be?
		],
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		adapt: async () => [
			enableNodeLibrary
				? (await import('../adapt/gro-adapter-node-library.js')).createAdapter()
				: null,
			// TODO
			// enableApiServer ? (await import('../adapt/gro-adapter-api-server.js')).createAdapter() : null,
			// enableGroFrontend
			// 	? (await import('../adapt/gro-adapter-spa-frontend.js')).createAdapter()
			// 	: null,
			enableSvelteKitFrontend
				? (await import('../adapt/gro-adapter-sveltekit-frontend.js')).createAdapter()
				: null,
		],
	};
	return partial;
};
