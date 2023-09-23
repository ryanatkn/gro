import type {GroConfig} from './src/lib/config.js';

/**
 * This is the config for the Gro project itself.
 * The default config for dependent projects is located at `./lib/gro.config.default.ts`.
 * The default should be referenced as an example implementation, not this one.
 */
const config: GroConfig = {
	plugins: async () => [
		(await import('./src/lib/gro_plugin_sveltekit_frontend.js')).plugin(),
		// TODO replace with an esbuild plugin, see the module for more
		// (await import('./lib/gro_plugin_gen.js')).plugin(),
	],
	adapters: async () =>
		Promise.all([
			(await import('./src/lib/gro_adapter_sveltekit_frontend.js')).create_adapter({
				host_target: 'github_pages',
			}),
			(await import('./src/lib/gro_adapter_library.js')).create_adapter(),
		]),
};

export default config;
