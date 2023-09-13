import * as esbuild from 'esbuild';
import {yellow, red, magenta} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
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

export interface Options {
	dev: boolean;
	build_options: esbuild.BuildOptions;
	dir?: string;
	svelte_compile_options?: CompileOptions;
	svelte_preprocessors?: PreprocessorGroup | PreprocessorGroup[];
	alias?: Record<string, string>;
	base_url?: '' | `/${string}` | undefined;
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
			console.log(
				'------------------------\n------------------------\n------------------------\nBUILDING\n------------------------\n------------------------\n-------------------------',
			);
			const building = esbuild.build({
				entryPoints: [source_id],
				plugins: [
					esbuild_plugin_sveltekit_shim_app(),
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

		build.onResolve(
			{filter: /\.worker(|\.js|\.ts)$/u},
			async ({path, importer, resolveDir, ...rest}) => {
				console.log(magenta('.'.repeat(50) + '\nexternal_worker\n' + '.'.repeat(50)));
				console.log(
					red('[external_worker] ENTER'),
					'\nimporting ' + yellow(path),
					'\nfrom ' + yellow(importer),
				);
				console.log(`rest:`, rest);
				const parsed = await resolve_specifier(path, importer, resolveDir);
				console.log(`parsed`, parsed);
				const {specifier, source_id, namespace} = parsed;

				const build_result = await build_worker(source_id);
				if (log) print_build_result(log, build_result);

				console.log(`build OPTS build.initialOptions.outdir`, build.initialOptions.outdir);
				console.log(`build OPTS build.initialOptions.outbase`, build.initialOptions.outbase);

				// TODO what about conflicting file names? need to alias them or something? rare enough to ignore?
				const final_specifier = './' + basename(specifier);
				console.log(
					red('[external_worker] resolved\n'),
					'\nimporting ' + yellow(final_specifier),
					'\nfrom ' + yellow(importer),
					'\nvia ' + yellow(specifier),
				);
				// TODO BLOCK
				// const FINAL_SPEC = await resolve_specifier(
				// 	specifier_id,
				// 	build.initialOptions.outdir + '/ignored',
				// );
				// console.log(`FINAL_SPEC`, FINAL_SPEC);
				return {path: final_specifier, external: true, namespace};
			},
		);
	},
});
