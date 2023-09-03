import type {GroConfigCreator, GroConfigPartial} from './lib/config/config.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./lib/config/gro.config.default.ts`.

const config: GroConfigCreator = async () => {
	const partial: GroConfigPartial = {
		sourcemap: true,
		logLevel: 'debug',
		plugin: async () => [
			// TODO BLOCK enable
			// (await import('./lib/plugin/gro-plugin-sveltekit-frontend.js')).createPlugin(),
			(await import('./lib/plugin/gro-plugin-gen.js')).createPlugin(),
		],
		// TODO maybe adapters should have flags for whether they run in dev or not? and allow overriding or something?
		adapt: async () =>
			Promise.all([
				// TODO BLOCK enable
				// (await import('./lib/adapt/gro-adapter-sveltekit-frontend.js')).createAdapter({
				// 	hostTarget: 'github_pages',
				// }),
				(await import('./lib/adapt/gro-adapter-node-library.js')).createAdapter(),
			]),
	};
	return partial;
};

export default config;
