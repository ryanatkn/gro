import {resolve} from 'node:path';

import type {Create_Gro_Config} from './gro_config.js';
import {gro_plugin_sveltekit_library} from './gro_plugin_sveltekit_library.js';
import {has_server, gro_plugin_server} from './gro_plugin_server.js';
import {gro_plugin_sveltekit_app} from './gro_plugin_sveltekit_app.js';
import {has_sveltekit_app, has_sveltekit_library} from './sveltekit_helpers.js';
import {gro_plugin_gen} from './gro_plugin_gen.js';
import {has_dep, load_package_json} from './package_json.js';
import {find_first_existing_file} from './search_fs.js';

// TODO hacky, maybe extract utils?

/**
 * This is the default config that's passed to `gro.config.ts`
 * if it exists in the current project, and if not, this is the final config.
 * It looks at the SvelteKit config and filesystem and tries to do the right thing:
 *
 * - if `src/routes`, assumes a SvelteKit frontend - respects `KitConfig.kit.files.routes`
 * - if `src/lib`, assumes a Node library - respects `KitConfig.kit.files.lib`
 * - if `src/lib/server/server.ts`, assumes a Node server - needs config
 */
const config: Create_Gro_Config = async (cfg, svelte_config) => {
	const package_json = load_package_json(); // TODO gets wastefully loaded by some plugins, maybe put in plugin/task context? how does that interact with `map_package_json`?

	const [has_moss_dep, has_server_result, has_sveltekit_library_result, has_sveltekit_app_result] =
		await Promise.all([
			has_dep('@ryanatkn/moss', package_json),
			has_server(),
			has_sveltekit_library(package_json, svelte_config),
			has_sveltekit_app(),
		]);

	const local_moss_plugin_path = find_first_existing_file([
		'./src/lib/gro_plugin_moss.ts',
		'./src/routes/gro_plugin_moss.ts',
	]);

	// put things that generate files before SvelteKit so it can see them
	cfg.plugins = async () =>
		[
			// TODO probably belongs in the gen system
			local_moss_plugin_path
				? (await import(resolve(local_moss_plugin_path))).gro_plugin_moss()
				: has_moss_dep
					? (await import('@ryanatkn/moss/gro_plugin_moss.js')).gro_plugin_moss()
					: null, // lazy load to avoid errors if it's not installed
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
