import type {GroConfigCreator} from './config.js';
import {base_path_to_source_id, LIB_DIR, LIB_DIRNAME} from '../util/paths.js';
import {exists} from '../util/exists.js';

/**
 * This is the default config that's passed to `src/gro.config.ts`
 * if it exists in the current project, and if not, this is the final config.
 * It looks at the project and tries to do the right thing:
 *
 * - if `src/routes`, assumes a SvelteKit frontend
 * - if `src/lib`, assumes a Node library
 * - if `src/lib/server/server.ts`, assumes a Node  server
 */
const config: GroConfigCreator = async () => {
	const [enable_library, enable_server, enable_sveltekit_frontend] = await Promise.all([
		has_library(),
		has_server(),
		has_sveltekit_frontend(),
	]);

	return {
		plugin: async () => [
			enable_server
				? (await import('../plugin/gro_plugin_server.js')).create_plugin({
						entry_points: [SERVER_SOURCE_ID],
				  })
				: null,
			enable_sveltekit_frontend
				? (await import('../plugin/gro_plugin_sveltekit_frontend.js')).create_plugin()
				: null,
			// TODO replace with an esbuild plugin, see the module for more
			// (await import('../plugin/gro_plugin_gen.js')).create_plugin(),
		],
		adapt: async () => [
			enable_library ? (await import('../adapt/gro_adapter_library.js')).create_adapter() : null,
			enable_sveltekit_frontend
				? (await import('../adapt/gro_adapter_sveltekit_frontend.js')).create_adapter({
						host_target: enable_server ? 'node' : 'github_pages',
				  })
				: null,
		],
	};
};

export default config;

export const has_library = (): Promise<boolean> => exists(LIB_DIR);

export const has_server = (): Promise<boolean> => exists(SERVER_SOURCE_ID);
export const SERVER_SOURCE_ID = base_path_to_source_id(LIB_DIRNAME + '/server/server.ts');

export const has_sveltekit_frontend = (): Promise<boolean> => exists('src/routes');
