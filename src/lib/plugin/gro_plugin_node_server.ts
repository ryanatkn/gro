import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import {existsSync, readFileSync} from 'node:fs';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import {yellow, red, blue, green} from 'kleur/colors';
import {dirname, join} from 'node:path';
import {escapeRegexp} from '@feltjs/util/regexp.js';

import type {Plugin, PluginContext} from './plugin.js';
import {
	NODE_SERVER_BUILD_BASE_PATH,
	NODE_SERVER_BUILD_NAME,
} from '../build/build_config_defaults.js';
import {paths} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';
import {watch_dir, type WatchNodeFs} from '../util/watch_dir.js';
import {load_sveltekit_config} from '../util/sveltekit_config.js';
import {esbuild_plugin_sveltekit_shim_app} from '../util/esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_shim_env} from '../util/esbuild_plugin_sveltekit_shim_env.js';
import {parse_specifier, print_build_result} from '../util/esbuild.js';

export interface Options {
	dir?: string;
	build_name?: BuildName; // defaults to 'server'
	base_build_path?: string; // defaults to 'server/server.js'
	env_files?: string[];
	ambient_env?: Record<string, string>;
}

export const create_plugin = ({
	dir = cwd() + '/',
	build_name = NODE_SERVER_BUILD_NAME,
	base_build_path = NODE_SERVER_BUILD_BASE_PATH,
	env_files,
	ambient_env,
}: Partial<Options> = {}): Plugin<PluginContext<object>> => {
	let build_ctx: esbuild.BuildContext;
	let watcher: WatchNodeFs;
	let server_process: RestartableProcess | null = null;

	const outdir = dir + '.gro/dev/' + build_name;
	const server_outfile = outdir + '/' + base_build_path;

	return {
		name: 'gro_plugin_node_server',
		setup: async ({dev, timings, config, log}) => {
			console.log(`[gro_plugin_node_server] dev`, dev); // TODO BLOCK
			const watch = dev;

			const sveltekit_config = await load_sveltekit_config(dir);
			const alias = sveltekit_config?.kit?.alias;
			const public_prefix = sveltekit_config?.kit?.env?.publicPrefix;
			const private_prefix = sveltekit_config?.kit?.env?.privatePrefix;
			const env_dir = sveltekit_config?.kit?.env?.dir;
			// TODO BLOCK support Svelte imports?
			// const compiler_options = sveltekit_config?.compilerOptions;

			const build_config = config.builds.find((c) => c.name === build_name);
			if (!build_config) throw Error('could not find build config ' + build_name);
			console.log(`build_config`, build_config);

			// TODO BLOCK maybe have a plugin for files that end in `_worker` to keep them external

			const timing_to_esbuild_create_context = timings.start('create build context');
			console.log(`config.target`, config.target);

			// TODO BLOCK hoist/refactor
			const esbuild_plugin_sveltekit_shim_alias = (): esbuild.Plugin => ({
				name: 'sveltekit_shim_alias',
				setup: (build) => {
					const aliases: Record<string, string> = {$lib: 'src/lib', ...alias};
					const alias_prefixes = Object.keys(aliases).map((a) => escapeRegexp(a));
					const filter = new RegExp('^(' + alias_prefixes.join('|') + ')', 'u');
					build.onResolve({filter}, async (args) => {
						const {path, ...rest} = args;
						const prefix = filter.exec(path)![1];
						return build.resolve(dir + aliases[prefix] + path.substring(prefix.length), rest);
					});
				},
			});

			// TODO BLOCK hoist/refactor
			const esbuild_plugin_sveltekit_local_imports = (): esbuild.Plugin => ({
				name: 'sveltekit_local_imports',
				setup: (build) => {
					build.onResolve({filter: /^(\/|\.)/u}, async ({path, ...rest}) => {
						const {importer} = rest;
						console.log(
							blue('[sveltekit_imports] ENTER path, importer'),
							green('1'),
							yellow(path),
							'\n',
							green(importer),
						);
						console.log(`rest`, rest);
						if (!importer) {
							return {
								path,
								namespace: 'sveltekit_local_imports_entrypoint',
							};
						}

						const parsed = await parse_specifier(path, importer);
						console.log(blue('[sveltekit_imports] EXIT'), parsed);
						const {final_path, source_path, namespace} = parsed;

						// const resolved = await build.resolve(final_path, rest);
						// console.log(`resolved`, resolved);
						return {path: final_path, namespace, pluginData: {source_path}};
					});
					// TODO BLOCK can we remove this?
					build.onLoad(
						{filter: /.*/u, namespace: 'sveltekit_local_imports_entrypoint'},
						async ({path}) => {
							console.log(red(`LOAD entrypoint path`), path);
							return {contents: readFileSync(path), loader: 'ts'};
						},
					);
					build.onLoad(
						{filter: /.*/u, namespace: 'sveltekit_local_imports_ts'},
						async ({path, pluginData: {source_path}}) => {
							console.log(red(`LOAD TS path, pluginData`), path, source_path);
							return {contents: readFileSync(source_path), loader: 'ts'};
						},
					);
					build.onLoad(
						{filter: /.*/u, namespace: 'sveltekit_local_imports_js'},
						async ({path, pluginData: {source_path}}) => {
							console.log(red(`LOAD JS path, pluginData`), path, source_path);
							return {contents: readFileSync(source_path), loader: 'js'};
						},
					);
					// build.onLoad(
					// 	{filter: /.*/u, namespace: 'sveltekit_local_imports_ts'},
					// 	async ({path}) => {
					// 		console.log(`LOAD path`, path);
					// 		let final_path;
					// 		let loader: esbuild.Loader | undefined = undefined;
					// 		if (existsSync(path)) {
					// 			final_path = path;
					// 		} else {
					// 			const ts_path = replace_extension(path, '.ts');
					// 			if (existsSync(ts_path)) {
					// 				final_path = ts_path;
					// 				loader = 'ts';
					// 			} else {
					// 				throw Error('CANNOT LOAD PATH ' + path);
					// 			}
					// 		}
					// 		return {contents: readFileSync(final_path), loader};
					// 	},
					// );
				},
			});

			build_ctx = await esbuild.context({
				entryPoints: build_config.input, // TODO BLOCK could map filters to files before calling this
				outdir,
				outbase: paths.lib, // TODO configure
				format: 'esm',
				platform: 'node',
				packages: 'external',
				bundle: true,
				target: config.target,
				plugins: [
					// TODO BLOCK extract and refactor with the existing helpers for the loader+postprocess
					esbuild_plugin_sveltekit_shim_app(),
					esbuild_plugin_sveltekit_shim_env({
						dev,
						public_prefix,
						private_prefix,
						env_dir,
						env_files,
						ambient_env,
					}),
					esbuild_plugin_sveltekit_shim_alias(),
					esbuild_plugin_sveltekit_local_imports(),
					// TODO BLOCK a few possibilities here
					// 1. arrange the plugins in the right order
					// 2. call resolve from one or the other (or both?)
					// 3. helpers like `parse_specifier`
					{
						name: 'external_worker',
						setup: (build) => {
							build.onResolve({filter: /\.worker(|\.js|\.ts)$/u}, async ({path, importer}) => {
								console.log(red('[external_worker] ENTER'), yellow(path), '\n', importer);

								const absolute_path = join(dirname(importer), path);
								console.log(`absolute_path`, absolute_path);

								// TODO BLOCK make sure this isn't called more than once if 2 files import it (probably need to cache)
								const build_result = await esbuild.build({
									// TODO BLOCK refactor options with above
									entryPoints: [absolute_path],
									outdir,
									outbase: paths.lib, // TODO configure
									format: 'esm',
									platform: 'node',
									packages: 'external',
									bundle: true,
									target: config.target,
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
										esbuild_plugin_sveltekit_shim_alias(),
										esbuild_plugin_sveltekit_local_imports(),
									],
								});
								print_build_result(log, build_result);

								return {path, external: true};
							});
						},
					},
				],
			});
			timing_to_esbuild_create_context();

			// TODO BLOCK can we watch dependencies of all of the files through esbuild?
			if (watch) {
				watcher = watch_dir({
					dir: paths.lib,
					on_change: async (change) => {
						console.log(`change`, change);
						const result = await build_ctx.rebuild(); // TODO BLOCK
						print_build_result(log, result);
						// server_process?.restart();
					},
				});
				// await watcher.init();
				console.log(`WATCHING paths.lib`, paths.lib);
			}

			console.log('INITIAL REBUILD');
			await build_ctx.rebuild();

			if (!existsSync(server_outfile)) {
				throw Error(`Node server failed to start due to missing file: ${server_outfile}`);
			}

			server_process = spawnRestartableProcess('node', [server_outfile]);
			console.log(`spawned`, server_process);
		},
		teardown: async () => {
			console.log('TEARING DOWN');

			if (server_process) {
				await server_process.kill();
				server_process = null;
			}
			if (watcher) {
				await watcher.close();
			}
			if (build_ctx) {
				await build_ctx.dispose();
			}
		},
	};
};
