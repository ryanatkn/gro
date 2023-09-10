import {spawnRestartableProcess, type RestartableProcess} from '@feltjs/util/process.js';
import {existsSync, readFileSync} from 'node:fs';
import * as esbuild from 'esbuild';
import {cwd} from 'node:process';
import {yellow, red} from 'kleur/colors'; // TODO BLOCK remove
import {extname} from 'node:path';

import type {Plugin, PluginContext} from './plugin.js';
import {
	NODE_SERVER_BUILD_BASE_PATH,
	NODE_SERVER_BUILD_NAME,
} from '../build/build_config_defaults.js';
import {paths} from '../path/paths.js';
import type {BuildName} from '../build/build_config.js';
import {watch_dir, type WatchNodeFs} from '../fs/watch_dir.js';
import {render_env_shim_module} from '../util/sveltekit_shim_env.js';
import {load_sveltekit_config} from '../util/sveltekit_config.js';

const dir = cwd() + '/';

export interface Options {
	build_name: BuildName; // defaults to 'server'
	base_build_path?: string; // defaults to 'server/server.js'
}

export const create_plugin = ({
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
		setup: async ({dev, timings, config}) => {
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
					const matcher = /^\$lib\//u;
					build.onResolve({filter: matcher}, async (args) => {
						// console.log(`[sveltekit_shim_alias] args`, args);
						const {path: specifier, ...rest} = args;
						console.log(yellow(`[sveltekit_shim_alias] enter path`), specifier);

						let path = dir + 'src/' + specifier.slice(1);
						const ext = extname(path);
						if (ext !== '.ts' && ext !== '.js' && ext !== '.svelte') path += '.ts'; // TODO BLOCK tricky because of files with `.(schema|task)` etc
						if (!existsSync(path)) throw Error('not found: ' + path); // TODO BLOCK remove
						console.log(yellow(`path`), path);
						if (path === specifier) return {path};
						const resolved = await build.resolve(path, rest);
						console.log(yellow(`[sveltekit_shim_alias] resolved path\n`), path, '->\n', resolved);
						// if (resolved.external) {
						// TODO BLOCK figure this out
						// return {...resolved, path: './password_worker.js'};
						// } else {
						return resolved;
						// }
						// return {path};
						// }
					});
				},
			});

			const create_sveltekit_shim_env_plugin = (): esbuild.Plugin => ({
				name: 'sveltekit_shim_env',
				setup: (build) => {
					const namespace = 'sveltekit_shim_env';
					const matcher = /^\$env\/(static|dynamic)\/(public|private)$/u;
					build.onResolve({filter: matcher}, ({path}) => ({path, namespace}));
					build.onLoad({filter: /.*/u, namespace}, (args) => {
						const {path} = args;
						const matches = matcher.exec(path);
						const mode = matches![1] as 'static' | 'dynamic';
						const visibility = matches![2] as 'public' | 'private';
						return {
							loader: 'ts',
							contents: render_env_shim_module(
								false, // TODO BLOCK
								mode,
								visibility,
								public_prefix,
								private_prefix,
								env_dir,
							),
						};
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
					create_sveltekit_shim_alias_plugin(),
					create_sveltekit_shim_env_plugin(),
					{
						name: 'external_worker',
						setup: (build) => {
							// TODO BLOCK construct matcher with $lib and each `config.alias`
							const matcher = /_worker/u; // TODO BLOCK maybe `.worker.(js|ts)`?
							const namespace = 'external_worker';
							build.onResolve({filter: matcher}, async (args) => {
								console.log(red(`[external_worker] path`), args);
								// return null;
								// return args;
								// const {path, ...rest} = args;
								// const resolved = await build.resolve(path, {
								// 	namespace: 'external_worker',
								// 	importer: args.importer,
								// 	resolveDir: args.resolveDir,
								// 	kind: args.kind,
								// });
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
										create_sveltekit_shim_alias_plugin(),
										create_sveltekit_shim_env_plugin(),
									],
								});
								console.log(`build_result.outputFiles[0]`, build_result);
								// console.log(`resolved`, resolved);
								// console.log(red(`ignoring rest`), path, rest);
								return {path: './password_worker.js', external: true};
								// const {path, ...rest} = args;
								// const resolved = await build.resolve(path, rest);
								// return {path: resolved.path, external: true};
							});
							// build.onLoad({filter: /.*/u, namespace}, (args) => {
							// 	console.log(red(`args`), args);
							// 	return {
							// 		loader: 'ts',
							// 		contents: readFileSync('src/lib/server/password_worker.ts', 'utf8'),
							// 	};
							// });
						},
					},
				],
			});
			timing_to_esbuild_create_context();
			// build.on('build', ({source_file, build_config}) => {
			// 	console.log(`source_file.id`, source_file.id);
			// 	if (source_file.id.endsWith('/gro/do/close.json')) {
			// 		console.log('CLOSE', source_file);
			// 		console.log(`build_config`, build_config);
			// 	}
			// });
			// TODO BLOCK can we watch dependencies of all of the files through esbuild?
			if (watch) {
				watcher = watch_dir({
					dir: paths.lib,
					on_change: async (change) => {
						console.log(`change`, change);
						// await build_ctx.rebuild(); // TODO BLOCK
						// server_process?.restart();
					},
				});
			}

			console.log('INITIAL REBUILD');
			await build_ctx.rebuild();

			if (!existsSync(server_outfile)) {
				throw Error(`Node server failed to start due to missing file: ${server_outfile}`);
			}

			server_process = spawnRestartableProcess('node', [server_outfile]);
			console.log(`spawned`, server_process);
		},
		teardown: async ({dev}) => {
			if (!dev) return;

			if (server_process) {
				await server_process.kill();
				server_process = null;
			}
			if (watcher) {
				await watcher.close();
			}
			if (build_ctx) {
				console.log('TEARING DOWN');
				await build_ctx.dispose();
			}
		},
	};
};
