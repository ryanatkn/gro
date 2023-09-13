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

// This is weird to avoid a SvelteKit warning,
// because SvelteKit detects usage as a string and not the AST.
const import_meta_env = 'import.meta' + '.env'; // eslint-disable-line no-useless-concat

// TODO maybe this belongs in a new `vite_helpers.ts`?
/**
 * @see https://esbuild.github.io/api/#define
 */
export const to_define_import_meta_env = (
	dev: boolean,
	base_url = '/', // TODO BLOCK source from Vite config (or SvelteKit? SvelteKit's `base` is different though, '' vs '/' and full URLs too)
	ssr = true,
	mode = dev ? 'development' : 'production',
): Record<string, string> => ({
	// see `import_meta_env` for why this is defined weirdly instead of statically
	[import_meta_env + 'DEV']: JSON.stringify(dev),
	[import_meta_env + 'PROD']: JSON.stringify(!dev),
	[import_meta_env + 'SSR']: JSON.stringify(ssr),
	[import_meta_env + 'MODE']: JSON.stringify(mode),
	[import_meta_env + 'BASE_URL']: JSON.stringify(base_url),
});

export const transform_options: esbuild.TransformOptions = {
	target: 'esnext',
	// TODO add support - runtime lookup to `source-map-support`,
	// maybe caching everything here to the filesystem, both source and sourcemaps,
	// or perhaps compile the sourcemaps lazily only when retrieved
	sourcemap: false,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8',
	// TODO BLOCK load local tsconfig
	tsconfigRaw: {
		compilerOptions: {
			importsNotUsedAsValues: 'error',
			preserveValueImports: true,
		},
	},
};
