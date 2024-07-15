import * as esbuild from 'esbuild';
import type {Logger} from '@ryanatkn/belt/log.js';
import {basename} from 'node:path';
import type {CompileOptions, PreprocessorGroup, ModuleCompileOptions} from 'svelte/compiler';

import {print_build_result, to_define_import_meta_env} from './esbuild_helpers.js';
import {resolve_specifier} from './resolve_specifier.js';
import {esbuild_plugin_sveltekit_shim_alias} from './esbuild_plugin_sveltekit_shim_alias.js';
import {esbuild_plugin_sveltekit_shim_env} from './esbuild_plugin_sveltekit_shim_env.js';
import {esbuild_plugin_sveltekit_shim_app} from './esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_local_imports} from './esbuild_plugin_sveltekit_local_imports.js';
import {esbuild_plugin_svelte} from './esbuild_plugin_svelte.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import type {Path_Id} from './path.js';

export interface Options {
	dev: boolean;
	build_options: esbuild.BuildOptions;
	dir?: string;
	svelte_compile_options?: CompileOptions;
	svelte_compile_module_options?: ModuleCompileOptions;
	svelte_preprocessors?: PreprocessorGroup | PreprocessorGroup[];
	alias?: Record<string, string>;
	base_url?: Parsed_Sveltekit_Config['base_url'];
	assets_url?: Parsed_Sveltekit_Config['assets_url'];
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
	dir = process.cwd(),
	svelte_compile_options,
	svelte_preprocessors,
	svelte_compile_module_options,
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
		const build_worker = async (path_id: Path_Id): Promise<esbuild.BuildResult> => {
			if (builds.has(path_id)) return builds.get(path_id)!;
			const building = esbuild.build({
				entryPoints: [path_id],
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
					esbuild_plugin_svelte({
						dir,
						svelte_compile_options,
						svelte_compile_module_options,
						svelte_preprocessors,
					}),
					esbuild_plugin_sveltekit_local_imports(),
				],
				define: to_define_import_meta_env(dev, base_url),
				...build_options,
			});
			builds.set(path_id, building);
			return building;
		};

		build.onResolve({filter: /\.worker(|\.js|\.ts)$/}, async ({path, resolveDir}) => {
			const parsed = resolve_specifier(path, resolveDir);
			const {specifier, path_id, namespace} = parsed;
			const build_result = await build_worker(path_id);
			if (log) print_build_result(log, build_result);
			return {path: './' + basename(specifier), external: true, namespace};
		});
	},
});
