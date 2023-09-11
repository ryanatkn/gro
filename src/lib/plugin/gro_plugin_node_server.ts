import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import {existsSync} from 'node:fs';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import {yellow, red, blue, green, cyan} from 'kleur/colors';
import {dirname, extname, join, relative} from 'node:path';
import {stripEnd} from '@feltjs/util/string.js';
import {escapeRegexp} from '@feltjs/util/regexp.js';

import type {Plugin, PluginContext} from './plugin.js';
import {
	NODE_SERVER_BUILD_BASE_PATH,
	NODE_SERVER_BUILD_NAME,
} from '../build/build_config_defaults.js';
import {paths} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';
import {watch_dir, type WatchNodeFs} from '../fs/watch_dir.js';
import {load_sveltekit_config} from '../util/sveltekit_config.js';
import {esbuild_plugin_sveltekit_shim_app} from '../util/esbuild_plugin_sveltekit_shim_app.js';
import {esbuild_plugin_sveltekit_shim_env} from '../util/esbuild_plugin_sveltekit_shim_env.js';
import {print_build_result} from '../util/esbuild.js';

export interface Options {
	dir?: string;
	build_name?: BuildName; // defaults to 'server'
	base_build_path?: string; // defaults to 'server/server.js'
}

export const create_plugin = ({
	dir = cwd() + '/',
	build_name = NODE_SERVER_BUILD_NAME,
	base_build_path = NODE_SERVER_BUILD_BASE_PATH,
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
						return build.resolve(aliases[prefix] + path.substring(prefix.length), rest);
					});
				},
			});

			// TODO BLOCK hoist/refactor
			const esbuild_plugin_sveltekit_imports = (): esbuild.Plugin => ({
				name: 'sveltekit_imports',
				setup: (build) => {
					// TODO BLOCK add .js as necessary and map from .ts?
					build.onResolve({filter: /.*/u}, async (args) => {
						console.log(
							blue('[sveltekit_imports] path, importer'),
							green('1'),
							yellow(args.path),
							'\n',
						);
						// TODO BLOCK handle this being '' for the entry
						console.log(`{args.importer}`, {importer: args.importer});

						const {path: original_path, ...rest} = args;
						let path = original_path;

						// const ext = extname(path);
						// if (ext !== '.ts' && ext !== '.js' && ext !== '.svelte') path += '.ts'; // TODO BLOCK tricky because of files with `.(schema|task)` etc

						// TODO BLOCK copypasta from loader - probably a helper that returns {id, specifier} (entryPoint and final path)
						// The specifier `path` has now been mapped to its final form, so we can inspect it.
						const path_is_relative = path[0] === '.';
						const path_is_absolute = path[0] === '/';
						if (!path_is_relative && !path_is_absolute) {
							// Handle external specifiers imported by internal code.
							throw new Error('TODO'); // TODO BLOCK
						}

						// TODO BLOCK needs to be relative?
						let js_path = path_is_relative ? join(args.importer, '../', path) : path;
						if (!path.endsWith('.js')) js_path += '.js'; // TODO BLOCK handle `.ts` imports too, and svelte, and ignore `.(schema|task.` etc, same helpers as esbuild plugin for server
						if (existsSync(js_path)) {
							path = js_path;
						} else {
							const ts_path = js_path.slice(0, -3) + '.ts';
							if (existsSync(ts_path)) {
								path = ts_path;
							}
						}

						console.log(
							blue('[sveltekit_imports] ABSOLUTE path'),
							green('22a'),
							yellow(path),
							original_path,
						);
						if (path === original_path) {
							return build.resolve(path, rest);
						}
						const absolute_path = path; // TODO BLOCK refactor
						path = relative(dirname(args.importer), absolute_path);
						if (path[0] !== '.') path = './' + path;
						console.log(
							blue('[sveltekit_imports] RELATIVE path'),
							green('22b'),
							yellow(path),
							args.importer,
						);

						const resolved = await build.resolve(path, rest);
						console.log(
							blue('[sveltekit_imports] RESOLVED path'),
							green('333'),
							yellow(path),
							resolved,
						);
						return resolved;
					});
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
					esbuild_plugin_sveltekit_shim_env(dev, public_prefix, private_prefix, env_dir),
					esbuild_plugin_sveltekit_shim_alias(),
					esbuild_plugin_sveltekit_imports(),
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
										esbuild_plugin_sveltekit_shim_env(dev, public_prefix, private_prefix, env_dir),
										esbuild_plugin_sveltekit_shim_alias(),
										esbuild_plugin_sveltekit_imports(),
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
