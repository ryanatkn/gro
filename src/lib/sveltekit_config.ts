import type {Config} from '@sveltejs/kit';
import type {CompileOptions, PreprocessorGroup} from 'svelte/compiler';
import {join} from 'node:path';
import {cwd} from 'node:process';

import {SVELTEKIT_CONFIG_FILENAME} from './paths.js';

/**
 * Loads a SvelteKit config at `dir`.
 * @returns
 */
export const load_sveltekit_config = async (dir: string = cwd()): Promise<Config | null> => {
	try {
		return (await import(join(dir, SVELTEKIT_CONFIG_FILENAME))).default;
	} catch (err) {
		return null;
	}
};

/**
 * A subset of SvelteKit's config in a form that Gro uses.
 * Flattens things out to keep them simple and easy to pass around,
 * and doesn't deal with most properties.
 * The `base` and `assets` in particular are renamed for clarity with Gro's internal systems,
 * so these properties become first-class vocabulary inside Gro.
 */
export interface ParsedSveltekitConfig {
	// TODO probably fill these out with defaults
	sveltekit_config: Config | null;
	alias: Record<string, string> | undefined;
	base_url: '' | `/${string}` | undefined;
	assets_url: '' | `http://${string}` | `https://${string}` | undefined;
	env_dir: string | undefined;
	private_prefix: string | undefined;
	public_prefix: string | undefined;
	svelte_compile_options: CompileOptions | undefined;
	svelte_preprocessors: PreprocessorGroup | PreprocessorGroup[] | undefined;
}

/**
 * Returns Gro-relevant properties of a SvelteKit config
 * as a convenience wrapper around `load_sveltekit_config`.
 */
export const init_sveltekit_config = async (
	dir_or_config: string | Config,
): Promise<ParsedSveltekitConfig> => {
	const sveltekit_config =
		typeof dir_or_config === 'string' ? await load_sveltekit_config(dir_or_config) : dir_or_config;
	const alias = sveltekit_config?.kit?.alias;
	const base_url = sveltekit_config?.kit?.paths?.base;
	const assets_url = sveltekit_config?.kit?.paths?.assets;
	const env_dir = sveltekit_config?.kit?.env?.dir;
	const private_prefix = sveltekit_config?.kit?.env?.privatePrefix;
	const public_prefix = sveltekit_config?.kit?.env?.publicPrefix;
	const svelte_compile_options = sveltekit_config?.compilerOptions;
	const svelte_preprocessors = sveltekit_config?.preprocess;
	return {
		sveltekit_config,
		alias,
		base_url,
		assets_url,
		env_dir,
		private_prefix,
		public_prefix,
		svelte_compile_options,
		svelte_preprocessors,
	};
};
