import {ENV_LOG_LEVEL, Log_Level} from '@feltcoop/felt/util/log.js';

import type {Gro_Config_Creator, Gro_Config_Partial} from './config.js';
import {
	has_node_library,
	NODE_LIBRARY_BUILD_CONFIG,
	has_sveltekit_frontend,
	has_api_server,
	API_SERVER_BUILD_CONFIG,
} from '../build/default_build_config.js';

/*

This is the default config that's passed to `src/gro.config.ts`
if it exists in the current project, and if not, this is the final config.
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

export const config: Gro_Config_Creator = async ({fs}) => {
	const [
		enable_node_library,
		enable_api_server,
		enable_sveltekit_frontend,
		// enable_gro_frontend,
	] = await Promise.all([
		has_node_library(fs),
		has_api_server(fs),
		has_sveltekit_frontend(fs),
		// has_deprecated_gro_frontend(fs),
	]);
	const partial: Gro_Config_Partial = {
		builds: [
			enable_node_library ? NODE_LIBRARY_BUILD_CONFIG : null,
			enable_api_server ? API_SERVER_BUILD_CONFIG : null,
			// enable_gro_frontend ? toDefaultBrowserBuild() : null, // TODO configure asset paths
			// note there's no build for SvelteKit frontends - should there be?
		],
		log_level: ENV_LOG_LEVEL ?? Log_Level.Trace,
		types: enable_node_library,
		plugin: async () => [
			enable_api_server
				? (await import('../plugin/gro-plugin-api-server.js')).create_plugin()
				: null,
			enable_sveltekit_frontend
				? (await import('../plugin/gro-plugin-sveltekit-frontend.js')).create_plugin()
				: null,
		],
		adapt: async () => [
			enable_node_library
				? (await import('../adapt/gro-adapter-node-library.js')).create_adapter()
				: null,
			enable_api_server
				? (await import('../adapt/gro-adapter-generic-build.js')).create_adapter({
						build_name: API_SERVER_BUILD_CONFIG.name,
				  })
				: null,
			// enable_gro_frontend
			// 	? (await import('../adapt/gro-adapter-spa-frontend.js')).create_adapter()
			// 	: null,
			enable_sveltekit_frontend
				? (await import('../adapt/gro-adapter-sveltekit-frontend.js')).create_adapter()
				: null,
		],
	};
	return partial;
};
