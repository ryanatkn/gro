import type {CreateGroConfig} from './config.js';
import {exists} from './exists.js';
import {has_server} from './gro_plugin_server.js';
import {load_package_json} from './package_json.js';
import {SVELTEKIT_CONFIG_FILENAME} from './paths.js';

/**
 * This is the default config that's passed to `gro.config.ts`
 * if it exists in the current project, and if not, this is the final config.
 * It looks at the project and tries to do the right thing:
 *
 * - if `src/routes`, assumes a SvelteKit frontend
 * - if `src/lib`, assumes a Node library
 * - if `src/lib/server/server.ts`, assumes a Node  server
 */
const config: CreateGroConfig = async (cfg) => {
	const [enable_library, enable_server, enable_sveltekit_frontend] = await Promise.all([
		has_library(),
		has_server(),
		has_sveltekit_frontend(),
	]);

	cfg.plugins = async () => [
		enable_library ? (await import('./gro_plugin_library.js')).plugin() : null,
		enable_server ? (await import('./gro_plugin_server.js')).plugin() : null,
		enable_sveltekit_frontend
			? (await import('./gro_plugin_sveltekit_frontend.js')).plugin({
					host_target: enable_server ? 'node' : 'github_pages',
			  })
			: null,
		// TODO replace with an esbuild plugin, see the module for more
		// (await import('./gro_plugin_gen.js')).plugin(),
	];

	return cfg;
};

export default config;

// TODO maybe move these and `has_server`?
export const has_library = async (): Promise<boolean> => {
	const package_json = await load_package_json(); // TODO from param, on config?
	return !!package_json.devDependencies && '@sveltejs/package' in package_json.devDependencies;
	// TODO need to use SvelteKit config
	// && exists(sveltekit_config.lib_path);
};

export const has_sveltekit_frontend = (): Promise<boolean> => exists(SVELTEKIT_CONFIG_FILENAME);
