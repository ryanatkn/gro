import * as esbuild from 'esbuild';
import {yellow, red, green} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';

import {parse_specifier, print_build_result} from './esbuild_helpers.js';
import {esbuild_plugin_sveltekit_shim_alias} from './esbuild_plugin_sveltekit_shim_alias.js';
import {esbuild_plugin_sveltekit_shim_env} from './esbuild_plugin_sveltekit_shim_env.js';
import {esbuild_plugin_sveltekit_shim_app} from './esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_local_imports} from './esbuild_plugin_sveltekit_local_imports.js';

export interface Options {
	dev: boolean;
	log: Logger;
	build_options: Pick<
		esbuild.BuildOptions,
		'outdir' | 'outbase' | 'format' | 'platform' | 'packages' | 'bundle' | 'target'
	>;
	dir: string;
	alias?: Record<string, string>;
	public_prefix?: string;
	private_prefix?: string;
	env_dir?: string;
	env_files?: string[];
	ambient_env?: Record<string, string>;
}

export const esbuild_plugin_external_worker = ({
	dev,
	log,
	build_options,
	dir,
	alias,
	public_prefix,
	private_prefix,
	env_dir,
	env_files,
	ambient_env,
}: Options): esbuild.Plugin => ({
	name: 'external_worker',
	setup: (build) => {
		build.onResolve({filter: /\.worker(|\.js|\.ts)$/u}, async ({path, importer, ...rest}) => {
			console.log(
				red('[external_worker] ENTER'),
				'\nimporting ' + yellow(path),
				'\nfrom ' + yellow(importer),
			);
			console.log(`rest:`, rest);
			const parsed = await parse_specifier(path, importer);
			console.log(`parsed`, parsed);
			const {specifier, source_id, namespace} = parsed;

			// TODO BLOCK make sure this isn't called more than once if 2 files import it (probably need to cache)
			console.log(
				'------------------------\n------------------------\n------------------------\nBUILDING\n------------------------\n------------------------\n-------------------------',
			);
			const build_result = await esbuild.build({
				...build_options,
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
					esbuild_plugin_sveltekit_local_imports(),
				],
			});
			console.log(
				'------------------------\n------------------------\n------------------------\nBUILD RESULT\n------------------------\n------------------------\n-------------------------\n',
				build_result,
			);
			print_build_result(log, build_result);
			// if (path !== specifier) {
			// 	const resolved = await build.resolve(source_id, {importer, kind: 'import-statement'});
			// 	console.log(`resolved`, resolved);
			// 	return resolved;
			// }
			// console.log(red('[external_worker] resolved'), resolved);
			return {path: specifier, external: true, namespace};
		});
	},
});
