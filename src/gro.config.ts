import type {GroConfigCreator, GroConfigPartial} from './lib/config/config.js';

/**
 * This is the config for the Gro project itself.
 * The default config for dependent projects is located at `./lib/config/gro.config.default.ts`.
 */
const config: GroConfigCreator = async () => {
	const partial: GroConfigPartial = {
		sourcemap: true,
		plugin: async () => [
			// TODO BLOCK enable
			// (await import('./lib/plugin/gro_plugin_sveltekit_frontend.js')).create_plugin(),
			(await import('./lib/plugin/gro_plugin_gen.js')).create_plugin(),
		],
		adapt: async () =>
			Promise.all([
				// TODO BLOCK enable
				// (await import('./lib/adapt/gro_adapter_sveltekit_frontend.js')).createAdapter({
				// 	host_target: 'github_pages',
				// }),
				(await import('./lib/adapt/gro_adapter_node_library.js')).createAdapter(),
			]),
	};
	return partial;
};

export default config;
