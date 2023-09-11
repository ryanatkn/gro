import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import {existsSync} from 'node:fs';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import {yellow, red} from 'kleur/colors';
import {extname, join, relative} from 'node:path';
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
			const create_sveltekit_shim_alias_plugin = (): esbuild.Plugin => ({
				name: 'sveltekit_shim_alias',
				setup: (build) => {
					// TODO BLOCK construct matcher with $lib and each `config.alias` as well as paths that start with `.` or `/` I think?
					const aliases: Record<string, string> = {$lib: 'src/lib', ...alias};
					const alias_prefixes = Object.keys(aliases).map((a) => escapeRegexp(a));
					console.log(`alias_prefixes`, alias_prefixes);
					const matcher = new RegExp('^(' + alias_prefixes.join('|') + ')', 'u');
					console.log(`matcher`, matcher);
					build.onResolve({filter: matcher}, async (args) => {
						// console.log(`[sveltekit_shim_alias] args`, args);
						const {path: specifier, ...rest} = args;
						const matches = matcher.exec(specifier)!;
						console.log(`matcher.exec(specifier)`, matches);
						const prefix = matches[1];
						const aliased = aliases[prefix];
						console.log(`prefix`, prefix);
						console.log(`aliased`, aliased);
						// console.log(yellow(`[sveltekit_shim_alias] enter path`), specifier);

						let path = dir + aliased + specifier.substring(prefix.length);
						console.log(`ALIASED path`, path);
						const ext = extname(path);
						if (ext !== '.ts' && ext !== '.js' && ext !== '.svelte') path += '.ts'; // TODO BLOCK tricky because of files with `.(schema|task)` etc
						if (!existsSync(path)) throw Error('not found: ' + path); // TODO BLOCK remove
						// console.log(yellow(`path`), path);
						if (path === specifier) return {path};
						const resolved = await build.resolve(path, rest);
						// console.log(yellow(`[sveltekit_shim_alias] resolved path\n`), path, '->\n', resolved);
						// if (resolved.external) {
						// TODO BLOCK figure this out
						// return {...resolved, path: './password_worker.js'};
						// } else {
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
				// external: ['*/password_worker.ts'], // TODO BLOCK only internal project should files get marked, not transitive deps
				plugins: [
					// TODO BLOCK extract and refactor with the existing helpers for the loader+postprocess
					esbuild_plugin_sveltekit_shim_app(),
					esbuild_plugin_sveltekit_shim_env(dev, public_prefix, private_prefix, env_dir),
					create_sveltekit_shim_alias_plugin(),
					{
						name: 'external_worker',
						setup: (build) => {
							// TODO BLOCK construct matcher with $lib and each `config.alias`
							const matcher = /\.worker(|\.js|\.ts)$/u;

							build.onResolve({filter: matcher}, async (args) => {
								console.log(red(`args.path, args.importer\n`), args.path, '\n', args.importer);
								let path = join(args.importer, '../', args.path);
								console.log(`path`, path);
								if (path[0] !== '.' && path[0] !== '/') path = './' + path;
								if (!path.endsWith('.js')) {
									const ext = extname(path);
									if (ext === '.ts') {
										path = stripEnd(path, ext) + '.js';
									} else if (ext !== '.js') {
										path += '.js';
									}
								}

								console.log(red(`path`), yellow(path));
								console.log(
									red(`[external_worker] building external worker path`),
									args.path,
									args.importer,
								);

								// TODO BLOCK make sure this isn't called more than once if 2 files import it (probably need to cache)
								const build_result = await esbuild.build({
									// TODO BLOCK refactor options with above
									entryPoints: [args.path],
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
										create_sveltekit_shim_alias_plugin(),
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
