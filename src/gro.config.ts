import {createFilter} from '@rollup/pluginutils';

import type {GroConfigCreator, GroConfigPartial} from './lib/config/config.js';
import {NODE_LIBRARY_BUILD_CONFIG, SYSTEM_BUILD_CONFIG} from './lib/build/buildConfigDefaults.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./lib/config/gro.config.default.ts`.

const config: GroConfigCreator = async ({dev}) => {
	const partial: GroConfigPartial = {
		builds: [
			{
				...NODE_LIBRARY_BUILD_CONFIG(dev), // TODO BLOCK remove/disable
				input: [
					'lib/index.ts',
					'lib/cli/gro.ts',
					'lib/cli/invoke.ts',
					'lib/config/gro.config.default.ts',
					// TODO probably extract these to another repo, felt or gen utils or something
					'lib/gen/helpers/html.ts',
					'lib/gen/helpers/ts.ts',
					'lib/util/sveltekitImportMocks.ts',
					createFilter(['lib/**/*.task.ts']),
				],
			},
			dev
				? {
						...SYSTEM_BUILD_CONFIG,
						input: SYSTEM_BUILD_CONFIG.input.concat('lib/util/sveltekitImportMocks.ts'),
				  }
				: null,
		],
		publish: '.',
		sourcemap: dev,
		typemap: !dev,
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
