import * as esbuild from 'esbuild';
import type {Logger} from '@grogarden/util/log.js';
import {basename} from 'node:path';
import {cwd} from 'node:process';
import type {CompileOptions, PreprocessorGroup} from 'svelte/compiler';

import {print_build_result, to_define_import_meta_env} from './esbuild_helpers.js';
import {resolve_specifier} from './resolve_specifier.js';
import {esbuild_plugin_sveltekit_shim_alias} from './esbuild_plugin_sveltekit_shim_alias.js';
import {esbuild_plugin_sveltekit_shim_env} from './esbuild_plugin_sveltekit_shim_env.js';
import {esbuild_plugin_sveltekit_shim_app} from './esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_local_imports} from './esbuild_plugin_sveltekit_local_imports.js';
import {esbuild_plugin_svelte} from './esbuild_plugin_svelte.js';
import type {ParsedSveltekitConfig} from './sveltekit_config.js';

export interface Options {
	dev: boolean;
	build_options: esbuild.BuildOptions;
	dir?: string;
	svelte_compile_options?: CompileOptions;
	svelte_preprocessors?: PreprocessorGroup | PreprocessorGroup[];
	alias?: Record<string, string>;
	base_url?: ParsedSveltekitConfig['base_url'];
	assets_url?: ParsedSveltekitConfig['assets_url'];
	public_prefix?: string;
	private_prefix?: string;
	env_dir?: string;
	env_files?: string[];
	ambient_env?: Record<string, string>;
	log?: Logger;
}

export const esbuild_plugin_external_worker = ({
	dev,
	build_options,
	dir = cwd(),
	svelte_compile_options,
	svelte_preprocessors,
	alias,
	base_url,
	assets_url,
	public_prefix,
	private_prefix,
	env_dir,
	env_files,
	ambient_env,
	log,
}: Options): esbuild.Plugin => ({
	name: 'external_worker',
	setup: (build) => {
		const builds: Map<string, Promise<esbuild.BuildResult>> = new Map();
		const build_worker = async (source_id: string): Promise<esbuild.BuildResult> => {
			if (builds.has(source_id)) return builds.get(source_id)!;
			const building = esbuild.build({
				entryPoints: [source_id],
				plugins: [
					esbuild_plugin_sveltekit_shim_app({dev, base_url, assets_url}),
					esbuild_plugin_sveltekit_shim_env({
						dev,
						public_prefix,
						private_prefix,
						env_dir,
						env_files,
						ambient_env,
					}),
					esbuild_plugin_sveltekit_shim_alias({dir, alias}),
					esbuild_plugin_svelte({dir, svelte_compile_options, svelte_preprocessors}),
					esbuild_plugin_sveltekit_local_imports(),
				],
				define: to_define_import_meta_env(dev, base_url),
				...build_options,
			});
			builds.set(source_id, building);
			return building;
		};

		build.onResolve({filter: /\.worker(|\.js|\.ts)$/u}, async ({path, resolveDir}) => {
			const parsed = await resolve_specifier(path, resolveDir);
			const {specifier, source_id, namespace} = parsed;
			const build_result = await build_worker(source_id);
			if (log) print_build_result(log, build_result);
			return {path: './' + basename(specifier), external: true, namespace};
		});
	},
});
