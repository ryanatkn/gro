import {ENV_LOG_LEVEL, Log_Level} from '@feltcoop/felt/util/log.js';

import type {GroConfigCreator, GroConfigPartial} from 'src/config/config.js';
import {
	has_node_library,
	NODE_LIBRARY_BUILD_CONFIG,
	has_sveltekit_frontend,
	has_api_server,
	API_SERVER_BUILD_CONFIG,
	has_gro_frontend,
	to_default_browser_build,
} from '../build/build_config_defaults.js';

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

export const config: GroConfigCreator = async ({fs}) => {
	const [enable_node_library, enable_api_server, enable_sveltekit_frontend, enable_gro_frontend] =
		await Promise.all([
			has_node_library(fs),
			has_api_server(fs),
			has_sveltekit_frontend(fs),
			has_gro_frontend(fs),
		]);
	const enable_dev_server = enable_gro_frontend;
	const partial: GroConfigPartial = {
		builds: [
			enable_node_library ? NODE_LIBRARY_BUILD_CONFIG : null,
			enable_api_server ? API_SERVER_BUILD_CONFIG : null,
			// note there's no build for SvelteKit frontends - should there be?
			enable_gro_frontend ? to_default_browser_build() : null, // TODO configure asset paths
		],
		log_level: ENV_LOG_LEVEL ?? Log_Level.Trace,
		types: enable_node_library,
		plugin: async () => [
			enable_dev_server
				? (await import('../plugin/gro_plugin_dev_server.js')).create_plugin()
				: null,
			enable_api_server
				? (await import('../plugin/gro_plugin_api_server.js')).create_plugin()
				: null,
			enable_sveltekit_frontend
				? (await import('../plugin/gro_plugin_sveltekit_frontend.js')).create_plugin()
				: null,
		],
		adapt: async () => [
			enable_node_library
				? (await import('../adapt/gro_adapter_node_library.js')).create_adapter()
				: null,
			enable_api_server
				? (await import('../adapt/gro_adapter_generic_build.js')).create_adapter({
						build_name: API_SERVER_BUILD_CONFIG.name,
				  })
				: null,
			enable_gro_frontend
				? (await import('../adapt/gro_adapter_gro_frontend.js')).create_adapter()
				: null,
			enable_sveltekit_frontend
				? (await import('../adapt/gro_adapter_sveltekit_frontend.js')).create_adapter()
				: null,
		],
	};
	return partial;
};
