import {createFilter} from '@rollup/pluginutils';
import {ENV_LOG_LEVEL, LogLevel} from '@feltcoop/felt/util/log.js';

import type {GroConfigCreator, GroConfigPartial} from './config/config.js';
import {NODE_LIBRARY_BUILD_CONFIG, SYSTEM_BUILD_CONFIG} from './build/buildConfigDefaults.js';

// This is the config for the Gro project itself.
// The default config for dependent projects is located at `./config/gro.config.default.ts`.

export const config: GroConfigCreator = async ({dev}) => {
	const partial: GroConfigPartial = {
		builds: [
			{
				...NODE_LIBRARY_BUILD_CONFIG,
				input: [
					'index.ts',
					'cli/gro.ts',
					'cli/invoke.ts',
					'config/gro.config.default.ts',
					// TODO probably extract these to another repo, felt or gen utils or something
					'gen/helpers/html.ts',
					'gen/helpers/ts.ts',
					'utils/sveltekitImportMocks.ts',
					createFilter(['**/*.task.ts']),
				],
			},
			dev
				? {
						...SYSTEM_BUILD_CONFIG,
						input: SYSTEM_BUILD_CONFIG.input.concat('utils/sveltekitImportMocks.ts'),
				  }
				: null,
		],
		publish: '.',
		sourcemap: dev,
		typemap: !dev,
		types: !dev,
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
		plugin: async () => [
			(await import('./plugin/gro-plugin-sveltekit-frontend.js')).createPlugin(),
		],
		// TODO maybe adapters should have flags for whether they run in dev or not? and allow overriding or something?
		adapt: async () =>
			Promise.all([
				(await import('./adapt/gro-adapter-sveltekit-frontend.js')).createAdapter({
					hostTarget: 'githubPages',
				}),
				(await import('./adapt/gro-adapter-node-library.js')).createAdapter({
					dir: 'dist',
					// TODO temp hack - unlike most libraries, Gro ships its dist/ as a sibling to src/,
					// and this flag opts out of the default library behavior
					pack: false,
					libraryRebasePath: '',
				}),
			]),
	};
	return partial;
};
