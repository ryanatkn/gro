import type {Create_Gro_Config} from './gro_config.js';
import {gro_plugin_sveltekit_library} from './gro_plugin_sveltekit_library.js';
import {has_server, gro_plugin_server} from './gro_plugin_server.js';
import {gro_plugin_sveltekit_app} from './gro_plugin_sveltekit_app.js';
import {has_sveltekit_app, has_sveltekit_library} from './sveltekit_helpers.js';

/**
 * This is the default config that's passed to `gro.config.ts`
 * if it exists in the current project, and if not, this is the final config.
 * It looks at the project and tries to do the right thing:
 *
 * - if `src/routes`, assumes a SvelteKit frontend
 * - if `src/lib`, assumes a Node library
 * - if `src/lib/server/server.ts`, assumes a Node server
 */
const config: Create_Gro_Config = async (cfg) => {
	const [has_sveltekit_library_result, has_server_result, has_sveltekit_app_result] =
		await Promise.all([has_sveltekit_library(), has_server(), has_sveltekit_app()]);

	cfg.plugins = () => [
		has_sveltekit_library_result.ok ? gro_plugin_sveltekit_library() : null,
		has_server_result.ok ? gro_plugin_server() : null,
		has_sveltekit_app_result.ok
			? gro_plugin_sveltekit_app({host_target: has_server_result.ok ? 'node' : 'github_pages'})
			: null,
		// TODO replace with an esbuild plugin, see the module for more
		// import {gro_plugin_gen} from './gro_plugin_gen.js';
		// gro_plugin_gen(),
	];

	return cfg;
};

export default config;
