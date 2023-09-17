import type {GroConfig} from './lib/config/config.js';

/**
 * This is the config for the Gro project itself.
 * The default config for dependent projects is located at `./lib/config/gro.config.default.ts`.
 * The default should be referenced as an example implementation, not this one.
 */
const config: GroConfig = {
	plugins: async () => [
		// TODO BLOCK re-enable
		// (await import('./lib/plugin/gro_plugin_sveltekit_frontend.js')).plugin(),
		// TODO replace with an esbuild plugin, see the module for more
		// (await import('./lib/plugin/gro_plugin_gen.js')).plugin(),
	],
	adapters: async () =>
		Promise.all([
			// TODO BLOCK re-enable
			// (await import('./lib/adapt/gro_adapter_sveltekit_frontend.js')).create_adapter({
			// 	host_target: 'github_pages',
			// }),
			(await import('./lib/adapt/gro_adapter_library.js')).create_adapter(),
		]),
};

export default config;
