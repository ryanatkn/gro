import type * as esbuild from 'esbuild';

import {to_sveltekit_app_specifier} from './sveltekit_shim_app.js';

export const esbuild_plugin_sveltekit_shim_app = (): esbuild.Plugin => ({
	name: 'sveltekit_shim_app',
	setup: (build) => {
		build.onResolve(
			{filter: /^\$app\/(environment|forms|navigation|paths|stores)$/u},
			({path, ...rest}) => build.resolve(to_sveltekit_app_specifier(path)!, rest),
		);
	},
});
