import type {Config} from '@sveltejs/kit';
import type {CompileOptions, PreprocessorGroup} from 'svelte/compiler';
import {join} from 'node:path';
import {cwd} from 'node:process';

/**
 * Loads a SvelteKit config at `dir`.
 * @returns
 */
export const load_sveltekit_config = async (dir: string = cwd()): Promise<Config | null> => {
	try {
		return (await import(join(dir, 'svelte.config.js'))).default;
	} catch (err) {
		return null;
	}
};

/**
 * Returns Gro-relevant properties of a SvelteKit config
 * as a convenience wrapper around `load_sveltekit_config`.
 */
export const init_sveltekit_config = async (
	dir_or_config: string | Config,
): Promise<{
	sveltekit_config: Config | null;
	alias: Record<string, string> | undefined;
	base_url: '' | `/${string}` | undefined;
	env_dir: string | undefined;
	private_prefix: string | undefined;
	public_prefix: string | undefined;
	svelte_compile_options: CompileOptions | undefined;
	svelte_preprocessors: PreprocessorGroup | PreprocessorGroup[] | undefined;
}> => {
	const sveltekit_config =
		typeof dir_or_config === 'string' ? await load_sveltekit_config(dir_or_config) : dir_or_config;
	const alias = sveltekit_config?.kit?.alias;
	const base_url = sveltekit_config?.kit?.paths?.base;
	const env_dir = sveltekit_config?.kit?.env?.dir;
	const private_prefix = sveltekit_config?.kit?.env?.privatePrefix;
	const public_prefix = sveltekit_config?.kit?.env?.publicPrefix;
	const svelte_compile_options = sveltekit_config?.compilerOptions;
	const svelte_preprocessors = sveltekit_config?.preprocess;
	return {
		sveltekit_config,
		alias,
		base_url,
		env_dir,
		private_prefix,
		public_prefix,
		svelte_compile_options,
		svelte_preprocessors,
	};
};
