import type {GroConfigCreator, GroConfigPartial} from './lib/config/config.js';
import {SYSTEM_BUILD_CONFIG} from './lib/build/buildConfigDefaults.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./lib/config/gro.config.default.ts`.

const config: GroConfigCreator = async ({dev}) => {
	const partial: GroConfigPartial = {
		builds: [
			dev
				? {
						...SYSTEM_BUILD_CONFIG,
						input: SYSTEM_BUILD_CONFIG.input.concat('lib/util/sveltekitImportMocks.ts'),
				  }
				: null,
		],
		sourcemap: dev,
		logLevel: 'debug',
		plugin: async () => [
			(await import('./lib/plugin/gro-plugin-sveltekit-frontend.js')).createPlugin(),
			dev ? (await import('./lib/plugin/gro-plugin-gen.js')).createPlugin() : null,
		],
		// TODO maybe adapters should have flags for whether they run in dev or not? and allow overriding or something?
		adapt: async () =>
			Promise.all([
				(await import('./lib/adapt/gro-adapter-sveltekit-frontend.js')).createAdapter({
					hostTarget: 'githubPages',
				}),
				(await import('./lib/adapt/gro-adapter-node-library.js')).createAdapter(),
			]),
	};
	return partial;
};

export default config;
