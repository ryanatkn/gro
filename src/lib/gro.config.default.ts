import type {Create_Gro_Config} from './gro_config.js';
import {gro_plugin_sveltekit_library} from './gro_plugin_sveltekit_library.js';
import {has_server, gro_plugin_server} from './gro_plugin_server.js';
import {gro_plugin_sveltekit_app} from './gro_plugin_sveltekit_app.js';
import {has_sveltekit_app, has_sveltekit_library} from './sveltekit_helpers.js';
import {gro_plugin_gen} from './gro_plugin_gen.js';
import {load_moss_plugin} from './moss_helpers.js';

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
	const [
		moss_plugin_result,
		has_sveltekit_library_result,
		has_server_result,
		has_sveltekit_app_result,
	] = await Promise.all([
		load_moss_plugin(),
		has_sveltekit_library(),
		has_server(),
		has_sveltekit_app(),
	]);

	cfg.plugins = () =>
		[
			// put things that generate files before SvelteKit so it can see them
			moss_plugin_result.ok ? moss_plugin_result.gro_plugin_moss() : null,
			gro_plugin_gen(),
			has_server_result.ok ? gro_plugin_server() : null,
			has_sveltekit_library_result.ok ? gro_plugin_sveltekit_library() : null,
			has_sveltekit_app_result.ok
				? gro_plugin_sveltekit_app({host_target: has_server_result.ok ? 'node' : 'github_pages'})
				: null,
		].filter((v) => v !== null);

	return cfg;
};

export default config;
