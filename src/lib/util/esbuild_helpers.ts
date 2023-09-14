import {yellow, red} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
import type * as esbuild from 'esbuild';

export const print_build_result = (log: Logger, build_result: esbuild.BuildResult): void => {
	for (const error of build_result.errors) {
		log.error(red('esbuild error'), error);
	}
	for (const warning of build_result.warnings) {
		log.warn(yellow('esbuild warning'), warning);
	}
};

// This concatenates weirdly to avoid a SvelteKit warning,
// because SvelteKit detects usage as a string and not the AST.
const import_meta_env = 'import.meta' + '.env'; // eslint-disable-line no-useless-concat

/**
 * Creates an esbuild `define` shim for Vite's `import.meta\.env`.
 * @see https://esbuild.github.io/api/#define
 * @param dev
 * @param base_url - best-effort shim from SvelteKit's `base` to Vite's `import.meta\.env.BASE_URL`
 * @param ssr
 * @param mode
 * @returns
 */
export const to_define_import_meta_env = (
	dev: boolean,
	base_url: '' | `/${string}` | undefined,
	ssr = true,
	mode = dev ? 'development' : 'production',
): Record<string, string> => ({
	// see `import_meta_env` for why this is defined weirdly instead of statically
	[import_meta_env + 'DEV']: JSON.stringify(dev),
	[import_meta_env + 'PROD']: JSON.stringify(!dev),
	[import_meta_env + 'SSR']: JSON.stringify(ssr),
	[import_meta_env + 'MODE']: JSON.stringify(mode),
	[import_meta_env + 'BASE_URL']: JSON.stringify(base_url || '/'), // it appears SvelteKit's `''` translates to Vite's `'/'`, so this intentionally falls back for falsy values, not just undefined
});

export const ts_transform_options: esbuild.TransformOptions = {
	target: 'esnext',
	// TODO add support - runtime lookup to `source-map-support`,
	// maybe caching everything here to the filesystem, both source and sourcemaps,
	// or perhaps compile the sourcemaps lazily only when retrieved
	sourcemap: false,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8',
	// TODO load local tsconfig
};
