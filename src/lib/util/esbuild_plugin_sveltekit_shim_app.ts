import type * as esbuild from 'esbuild';

import {to_sveltekit_app_specifier} from './sveltekit_shim_app.js';

const name = 'sveltekit_shim_app';

export const esbuild_plugin_sveltekit_shim_app = (): esbuild.Plugin => ({
	name,
	setup: (build) => {
		build.onResolve(
			{filter: /^\$app\/(environment|forms|navigation|paths|stores)$/u},
			({path, ...rest}) => {
				const mapped = to_sveltekit_app_specifier(path);
				if (!mapped)
					throw Error(`plugin "${name}" failed to map path to SvelteKit app shim: ${path}`);
				return build.resolve(mapped, rest);
			},
		);
	},
});
