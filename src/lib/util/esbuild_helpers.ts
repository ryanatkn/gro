import {yellow, red} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
import type * as esbuild from 'esbuild';
import {dirname, extname, join, relative} from 'node:path';

import {replace_extension} from '../path/paths.js';
import {exists} from './exists.js';

export interface ParsedSpecifier {
	specifier: string;
	// TODO BLOCK see below
	// specifier_id: string;
	source_id: string;
	namespace: string;
}

/**
 * Maps `path` relative to the `importer`, and infer the correct extension.
 * If no `.js` file is found for the `path` on the filesystem, it assumes `.ts`.
 */
export const parse_specifier = async (
	path: string,
	importer: string,
	dir: string,
): Promise<ParsedSpecifier> => {
	// TODO BLOCK ?
	if (!dir) throw Error('DELETEME'); // TODO BLOCK
	const path_absolute = path[0] === '.' ? join(dir, path) : path;
	const importer_absolute = importer[0] === '.' ? join(dirname(path), importer) : importer;

	const ext = extname(path_absolute);
	const is_js = ext === '.js';
	const is_ts = ext === '.ts';
	const passthrough_extensions = new Set(['.svelte']); // TODO BLOCK param? include .js? see below for diff logic for js tho
	const passthrough = passthrough_extensions.has(ext);
	const js_path =
		is_js || passthrough
			? path_absolute
			: is_ts
			? replace_extension(path_absolute, '.js')
			: path_absolute + '.js';

	let mapped_path;
	let source_id;
	let namespace;
	if (await exists(js_path)) {
		// a `.js` version exists on the filesystem, so use it
		namespace = 'sveltekit_local_imports_js';
		mapped_path = js_path;
		source_id = js_path;
	} else {
		// assume `.ts`, so other plugins like for `.svelte` and `.json` must be added earlier
		namespace = 'sveltekit_local_imports_ts';
		source_id =
			is_ts || passthrough
				? path_absolute
				: is_js
				? replace_extension(path_absolute, '.ts')
				: path_absolute + '.ts';
		mapped_path = replace_extension(source_id, '.js');
	}

	let specifier = relative(dirname(importer_absolute), mapped_path);
	if (specifier[0] !== '.') specifier = './' + specifier;

	// const specifier_id = join(dirname(importer_absolute), specifier);
	// specifier_id,

	return {specifier, source_id, namespace};
};

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
