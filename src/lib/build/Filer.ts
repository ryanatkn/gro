import {resolve, extname, join, dirname} from 'node:path';
import {EventEmitter} from 'node:events';
import type StrictEventEmitter from 'strict-event-emitter-types';
import {omitUndefined} from '@feltjs/util/object.js';
import {UnreachableError} from '@feltjs/util/error.js';
import {printLogLabel, SystemLogger, type Logger} from '@feltjs/util/log.js';
import {gray, red, cyan} from 'kleur/colors';
import {printError} from '@feltjs/util/print.js';
import type {Assignable, PartialExcept} from '@feltjs/util/types.js';
import type {Config} from '@sveltejs/kit';
import fs from 'fs-extra';
import {existsSync, mkdirSync, readFileSync, rmdirSync, writeFileSync} from 'node:fs';

import {create_filer_dir, type FilerDir, type FilerDirChangeCallback} from '../build/filer_dir.js';
import {
	is_input_to_build_config,
	map_dependency_to_source_id,
	type EcmaScriptTarget,
	type MapDependencyToSourceId,
} from './helpers.js';
import {
	paths as defaultPaths,
	to_build_out_path,
	type Paths,
	type SourceId,
	is_this_project_gro,
} from '../path/paths.js';
import type {BuildContext, Builder} from './builder.js';
import {print_build_config_label} from '../build/build_config.js';
import type {BuildName, BuildConfig} from './build_config.js';
import {assert_source_file, create_source_file, type SourceFile} from './source_file.js';
import {diff_dependencies, type BuildFile} from './build_file.js';
import type {BaseFilerFile, FilerFile, FilerFileId} from './filer_file.js';
import {
	type SourceMeta,
	delete_source_meta,
	update_source_meta,
	init_source_meta,
} from './source_meta.js';
import type {BuildDependency} from './build_dependency.js';
import type {PathFilter} from '../fs/filter.js';
import {is_external_module} from '../path/module.js';
import {throttle} from '../util/throttle.js';
import {render_env_shim_module} from '../util/sveltekit_shim_env.js';

/*

The `Filer` is at the heart of the build system.

The `Filer` wholly owns its `build_dir`, `./.gro` by default.
If any files or directories change inside it without going through the `Filer`,
it may go into a corrupted state.
Corrupted states can be fixed by turning off the `Filer` and running `gro clean`.

*/

// The Filer is an `EventEmitter` with the following events:
type FilerEmitter = StrictEventEmitter<EventEmitter, FilerEvents>;
export interface FilerEvents {
	build: {source_file: SourceFile; build_config: BuildConfig};
}

export interface Options {
	paths: Paths;
	dev: boolean;
	builder: Builder;
	build_configs: BuildConfig[];
	build_dir: string;
	source_dirs: string[];
	map_dependency_to_source_id: MapDependencyToSourceId;
	sourcemap: boolean;
	types: boolean;
	target: EcmaScriptTarget;
	watch: boolean;
	filter: PathFilter | undefined;
	cleanOutputDirs: boolean;
	log: Logger;
}
export type RequiredOptions = 'builder' | 'build_configs' | 'source_dirs';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	const paths = opts.paths ?? defaultPaths;
	const dev = opts.dev ?? true;
	if (opts.build_configs.length === 0) {
		throw Error('Filer created with an empty array of build_configs.');
	}
	const build_dir = opts.build_dir || paths.build; // TODO assumes trailing slash
	const source_dirs = validate_dirs(opts.source_dirs);
	return {
		map_dependency_to_source_id,
		sourcemap: true,
		types: !dev,
		target: 'esnext',
		watch: true,
		filter: undefined,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		paths,
		dev,
		log: opts.log || new SystemLogger(printLogLabel('filer')),
		build_dir,
		source_dirs,
	};
};

export class Filer extends (EventEmitter as {new (): FilerEmitter}) implements BuildContext {
	private readonly files: Map<FilerFileId, FilerFile> = new Map();
	private readonly dirs: FilerDir[];
	private readonly builder: Builder;
	private readonly map_dependency_to_source_id: MapDependencyToSourceId;

	// These public `BuildContext` properties are available to e.g. builders, helpers, postprocessors.
	// This pattern lets us pass around `this` filer
	// without constantly destructuring and handling long argument lists.
	readonly paths: Paths;
	readonly build_configs: readonly BuildConfig[];
	readonly build_names: Set<BuildName>;
	readonly source_meta_by_id: Map<SourceId, SourceMeta> = new Map();
	readonly log: Logger;
	readonly build_dir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget; // TODO shouldn't build configs have this?
	readonly building_source_files: Set<SourceId> = new Set(); // needed by hacky externals code, used to check if the filer is busy
	// TODO not sure about this
	readonly find_by_id = (id: string): BaseFilerFile | undefined => this.files.get(id);

	constructor(opts: InitialOptions) {
		super();
		const {
			paths,
			dev,
			builder,
			build_configs,
			build_dir,
			source_dirs,
			map_dependency_to_source_id,
			sourcemap,
			target,
			watch,
			filter,
			log,
		} = initOptions(opts);
		this.paths = paths;
		this.dev = dev;
		this.builder = builder;
		this.build_configs = build_configs;
		this.build_names = new Set(build_configs.map((b) => b.name));
		this.build_dir = build_dir;
		this.map_dependency_to_source_id = map_dependency_to_source_id;
		this.sourcemap = sourcemap;
		this.target = target;
		this.log = log;
		// Creates objects to load a directory's content and sync filesystem changes in memory.
		// The order of objects in the returned array is meaningless.
		this.dirs = source_dirs.map((source_dir) =>
			create_filer_dir(source_dir, this.on_dir_change, watch, filter),
		);
		log.debug(cyan('created Filer with build_configs'), Array.from(this.build_names).join(', '));
	}

	close(): void {
		for (const dir of this.dirs) {
			dir.close();
		}
	}

	private initialized = false;

	async init(): Promise<void> {
		if (this.initialized) throw Error('Filer already initialized');
		this.initialized = true;

		this.log.debug('init', gray(this.dev ? 'development' : 'production'));

		await init_source_meta(this);
		// this.log.debug('inited and cleaned cache');

		// This initializes all files in the filer's directories, loading them into memory,
		// including source files and build files.
		// Initializing the dirs must be done after `this.init_source_meta`
		// because it creates source files, which need `this.source_meta_by_id` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// this.log.debug('inited files');

		// This initializes the builders. Should be done before the builds are initialized.
		// TODO does this belong in `dir.init`? or parallel with .. what?
		// what data is not yet ready? does this belong inside `init_builds`?
		if (this.builder.init) {
			await this.builder.init(this);
		}

		// This performs the initial source file build, traces deps,
		// and populates the `build_configs` property of all source files.
		await this.init_builds();
		// this.log.debug('inited builds:', Array.from(this.build_names).join(', '));

		// TODO check if `src/` has any conflicting dirs like `src/externals`

		// this.log.debug('initialized!');
	}

	// During initialization, after all files are loaded into memory,
	// this is called to populate the `build_configs` property of all source files.
	// It traces the dependencies starting from each `build_config.input`,
	// building each input source file and populating its `build_configs`,
	// recursively until all dependencies have been handled.
	private async init_builds(): Promise<void> {
		const promises: Array<Promise<void>> = [];

		const filters: Array<(id: string) => boolean> = [];
		const filterBuildConfigs: BuildConfig[] = [];

		// Iterate through the build config inputs and initialize their files.
		for (const build_config of this.build_configs) {
			for (const input of build_config.input) {
				if (typeof input === 'function') {
					filters.push(input);
					filterBuildConfigs.push(build_config);
					continue;
				}
				const file = this.files.get(input);
				// TODO this assert throws with a bad error - should print `input`
				try {
					assert_source_file(file);
				} catch (_err) {
					this.log.error(print_build_config_label(build_config), red('missing input'), input);
					throw Error('Missing input: check the build config and source files for the above input');
				}
				if (!file.build_configs.has(build_config)) {
					promises.push(this.add_source_file_to_build(file, build_config, true));
				}
			}

			// Add the virtual shim files to support SvelteKit $env imports.
			// We don't do this for Gro because it doesn't use env vars internally for development,
			// and we don't want to ship these virtual modules in the library.
			if (!is_this_project_gro) {
				promises.push(this.add_sveltekit_env_shim_files(build_config));
			}
		}

		// Iterate through the files once and apply the filters to all source files.
		if (filters.length) {
			for (const file of this.files.values()) {
				if (file.type !== 'source') continue;
				for (let i = 0; i < filters.length; i++) {
					if (filters[i](file.id)) {
						const build_config = filterBuildConfigs[i];
						if (!file.build_configs.has(build_config)) {
							promises.push(this.add_source_file_to_build(file, build_config, true));
						}
					}
				}
			}
		}

		await Promise.all(promises);
	}

	private async add_virtual_source_files(
		build_config: BuildConfig,
		files: Array<{id: string; content: string; extension?: string}>,
	): Promise<void> {
		await Promise.all(
			this.dirs
				.map((dir) =>
					files.map(({id, content, extension = '.ts'}) =>
						this.add_virtual_source_file(build_config, dir, id, extension, content),
					),
				)
				.flat(),
		);
	}

	private async add_virtual_source_file(
		build_config: BuildConfig,
		dir: FilerDir,
		id: string,
		extension: string,
		content: string,
	): Promise<void> {
		const env_source_file = await create_source_file(
			id,
			extension,
			content,
			dir,
			this.source_meta_by_id.get(id), // always `undefined` atm but seems more correct for the future
			true,
			this,
		);
		await this.init_source_file(env_source_file);
		await this.add_source_file_to_build(env_source_file, build_config, true);
		await update_source_meta(this, env_source_file);
	}

	// TODO include only when imported, and keep in sync at runtime
	private async add_sveltekit_env_shim_files(build_config: BuildConfig): Promise<void> {
		let config: Config | undefined; // TODO ideally this would be `ValidatedConfig` but SvelteKit doesn't expose its load config helper
		try {
			config = (await import(this.paths.root + 'svelte.config.js')).default;
		} catch (err) {}
		const public_prefix = config?.kit?.env?.publicPrefix;
		const private_prefix = config?.kit?.env?.privatePrefix;
		const env_dir = config?.kit?.env?.dir;
		await this.add_virtual_source_files(build_config, [
			{
				id: this.paths.lib + '/sveltekit_shim_env_static_public.ts',
				content: render_env_shim_module(
					this.dev,
					'static',
					'public',
					public_prefix,
					private_prefix,
					env_dir,
				),
			},
			{
				id: this.paths.lib + '/sveltekit_shim_env_static_private.ts',
				content: render_env_shim_module(
					this.dev,
					'static',
					'private',
					public_prefix,
					private_prefix,
					env_dir,
				),
			},
			{
				id: this.paths.lib + '/sveltekit_shim_env_dynamic_public.ts',
				content: render_env_shim_module(
					this.dev,
					'dynamic',
					'public',
					public_prefix,
					private_prefix,
					env_dir,
				),
			},
			{
				id: this.paths.lib + '/sveltekit_shim_env_dynamic_private.ts',
				content: render_env_shim_module(
					this.dev,
					'dynamic',
					'private',
					public_prefix,
					private_prefix,
					env_dir,
				),
			},
		]);
	}

	// Adds a build config to a source file.
	// The caller is expected to check to avoid duplicates.
	private async add_source_file_to_build(
		source_file: SourceFile,
		build_config: BuildConfig,
		is_input: boolean,
	): Promise<void> {
		// this.log.debug(
		// 	`adding source file to build ${print_build_config_label(build_config)} ${gray(source_file.id)}`,
		// );
		if (source_file.build_configs.has(build_config)) {
			throw Error(`Already has build_config ${build_config.name}: ${gray(source_file.id)}`);
		}
		// Add the build config. The caller is expected to check to avoid duplicates.
		source_file.build_configs.add(build_config);
		// Add the build config as an input if appropriate, initializing the set if needed.
		// We need to determine `is_input_to_build_config` independently of the caller,
		// because the caller may not
		if (is_input) {
			if (source_file.is_input_to_build_configs === null) {
				// Cast to keep the `readonly` modifier outside of initialization.
				(
					source_file as Assignable<SourceFile, 'is_input_to_build_configs'>
				).is_input_to_build_configs = new Set();
			}
			source_file.is_input_to_build_configs!.add(build_config);
		}

		// Build only if needed - build files may be hydrated from the cache.
		const has_build_config = source_file.build_files.has(build_config);
		if (has_build_config) {
			await this.hydrate_source_file_from_cache(source_file, build_config);
		}
		const {dirty} = source_file;
		if (!has_build_config || dirty) {
			await this.build_source_file(source_file, build_config);
			if (dirty) source_file.dirty = false;
		}
	}

	// Removes a build config from a source file.
	// The caller is expected to check to avoid duplicates.
	private async remove_source_file_from_build(
		source_file: SourceFile,
		build_config: BuildConfig,
		should_update_source_meta = true,
	): Promise<void> {
		this.log.debug(
			`${print_build_config_label(build_config)} removing source file ${gray(source_file.id)}`,
		);

		await this.update_build_files(source_file, [], build_config);

		const deleted = source_file.build_configs.delete(build_config);
		if (!deleted) {
			throw Error(`Expected to delete build_config ${build_config.name}: ${source_file.id}`);
		}
		const deleted_build_files = source_file.build_files.delete(build_config);
		if (!deleted_build_files) {
			throw Error(`Expected to delete build files ${build_config.name}: ${source_file.id}`);
		}
		source_file.dependencies.delete(build_config);
		source_file.dependents.delete(build_config);

		if (should_update_source_meta) {
			update_source_meta(this, source_file);
		}
	}

	private on_dir_change: FilerDirChangeCallback = async (change, filer_dir) => {
		const id = join(filer_dir.dir, change.path);
		// console.log(red(change.type), id); // TODO maybe make an even more verbose log level for this?
		switch (change.type) {
			case 'init':
			case 'create':
			case 'update': {
				if (change.stats.isDirectory()) {
					// We could ensure the directory, but it's usually wasted work,
					// and `fs-extra` takes care of adding missing directories when writing to disk.
				} else {
					const should_build = await this.update_source_file(id, filer_dir);
					if (
						should_build &&
						// When initializing, building is deferred to `init_builds`
						// so that deps are determined in the correct order.
						change.type !== 'init'
					) {
						const file = this.files.get(id);
						assert_source_file(file);
						if (change.type === 'create') {
							await this.init_source_file(file);
						} else {
							await Promise.all(
								Array.from(file.build_configs).map((build_config) =>
									this.build_source_file(file, build_config),
								),
							);
						}
					}
				}
				break;
			}
			case 'delete': {
				if (change.stats.isDirectory()) {
					// TODO This is weird because we're blindly deleting
					// the directory for all build configs,
					// whether or not they apply for this id.
					// It could be improved by tracking tracking dirs in the Filer
					// and looking up the correct build configs.
					for (const build_config of this.build_configs) {
						rmdirSync(to_build_out_path(this.dev, build_config.name, change.path, this.build_dir));
					}
				} else {
					await this.destroy_source_id(id);
				}
				break;
			}
			default:
				throw new UnreachableError(change.type);
		}
	};

	// Initialize a newly created source file's builds.
	// It currently uses a slow brute force search to find dependents.
	private async init_source_file(file: SourceFile): Promise<void> {
		let promises: Array<Promise<void>> | null = null;
		let dependent_build_configs: Set<BuildConfig> | null = null;
		// TODO could be sped up with some caching data structures
		for (const f of this.files.values()) {
			if (f.type !== 'source') continue;
			for (const [build_config, dependencies_map] of f.dependencies) {
				if (dependencies_map.has(file.id)) {
					const dependencies = dependencies_map.get(file.id)!;
					for (const dependency of dependencies.values()) {
						add_dependent(f, file, build_config, dependency);
					}
					(dependent_build_configs || (dependent_build_configs = new Set())).add(build_config);
				}
			}
		}
		let input_build_configs: Set<BuildConfig> | null = null;
		for (const build_config of this.build_configs) {
			if (is_input_to_build_config(file.id, build_config.input)) {
				(input_build_configs || (input_build_configs = new Set())).add(build_config);
				(promises || (promises = [])).push(this.add_source_file_to_build(file, build_config, true));
			}
		}
		if (dependent_build_configs !== null) {
			for (const build_config of dependent_build_configs) {
				if (input_build_configs?.has(build_config)) continue;
				(promises || (promises = [])).push(
					this.add_source_file_to_build(file, build_config, false),
				);
			}
		}
		if (promises !== null) await Promise.all(promises);
	}

	updating_source_files: Map<SourceId, Promise<boolean>> = new Map();

	// Returns a boolean indicating if the source file should be built.
	// The source file may have been updated or created from a cold cache.
	// It batches calls together, but unlike `build_source_file`, it don't queue them,
	// and instead just returns the pending promise.
	private async update_source_file(id: SourceId, filer_dir: FilerDir): Promise<boolean> {
		const updating = this.updating_source_files.get(id);
		if (updating) return updating;
		const done = () => this.updating_source_files.delete(id);
		const promise: Promise<boolean> = Promise.resolve()
			.then(async () => {
				// this.log.debug(`updating source file ${gray(id)}`);
				const source_file = this.files.get(id);
				if (source_file) {
					assert_source_file(source_file);
					if (source_file.filer_dir !== filer_dir) {
						// This can happen when watchers overlap, a file picked up by two `FilerDir`s.
						// We might be able to support this,
						// but more thought needs to be given to the exact desired behavior.
						// See `validate_dirs` for more.
						throw Error(
							'Source file filer_dir unexpectedly changed: ' +
								`${gray(source_file.id)} changed from ${source_file.filer_dir.dir} to ${
									filer_dir.dir
								}`,
						);
					}
				}

				const extension = source_file ? source_file.extension : extname(id);
				const new_source_content = readFileSync(id, 'utf8'); // TODO problem with this is loading stuff not part of the build (for serving, could lazy load)

				if (!source_file) {
					// Memory cache is cold.
					if (is_external_module(id)) {
						throw Error('TODO unexpected');
					}
					const new_source_file = await create_source_file(
						id,
						extension,
						new_source_content,
						filer_dir,
						this.source_meta_by_id.get(id), // TODO should this lazy load the source meta?
						false,
						this,
					);
					this.files.set(id, new_source_file);
					// If the created source file has its build files hydrated from the cache,
					// we assume it doesn't need to be built.
					if (new_source_file.build_files.size !== 0) {
						return false;
					}
				} else if (source_file.content === new_source_content) {
					// Memory cache is warm and source code hasn't changed, do nothing and exit early!
					return false;
				} else {
					// Memory cache is warm, but content have changed.
					(source_file as Assignable<SourceFile, 'content'>).content = new_source_content as string;
					source_file.stats = undefined;
					source_file.content_buffer = undefined;
					source_file.content_hash = undefined;
				}
				return true;
			})
			.then(
				(value) => {
					done();
					return value;
				},
				(err) => {
					done();
					throw err;
				},
			);
		this.updating_source_files.set(id, promise);
		return promise;
	}

	private build_source_file = throttle(
		async (source_file: SourceFile, build_config: BuildConfig): Promise<void> => {
			try {
				await this._build_source_file(source_file, build_config);
				this.emit('build', {source_file, build_config});
			} catch (err) {
				// TODO probably want to track this failure data
				this.log.error(
					print_build_config_label(build_config),
					red('build failed'),
					gray(source_file.id),
					printError(err),
				);
			}
		},
		(source_file, build_config) => build_config.name + '::' + source_file.id,
	);

	private async _build_source_file(
		source_file: SourceFile,
		build_config: BuildConfig,
	): Promise<void> {
		this.log.debug(
			`${print_build_config_label(build_config)} build source file`,
			gray(source_file.id),
		);

		// Compile the source file.
		let build_files: BuildFile[];

		this.building_source_files.add(source_file.id); // track so we can see what the filer is doing
		try {
			build_files = await this.builder.build(source_file, build_config, this);
		} catch (err) {
			this.building_source_files.delete(source_file.id);
			throw err;
		}
		this.building_source_files.delete(source_file.id);

		// Update the source file with the new build files.
		await this.update_build_files(source_file, build_files, build_config);
		await update_source_meta(this, source_file);
	}

	// Updates the build files in the memory cache and writes to disk.
	private async update_build_files(
		source_file: SourceFile,
		new_build_files: BuildFile[],
		build_config: BuildConfig,
	): Promise<void> {
		const old_build_files = source_file.build_files.get(build_config) || null;
		const changes = diff_build_files(new_build_files, old_build_files);
		source_file.build_files.set(build_config, new_build_files);
		sync_build_files_to_memory_cache(this.files, changes);
		await Promise.all([
			sync_build_files_to_disk(changes, this.log),
			this.update_dependencies(source_file, new_build_files, old_build_files, build_config),
		]);
	}

	// This is like `update_build_files` except
	// it's called for source files when they're being hydrated from the cache.
	// This is because the normal build process ending with `update_build_files`
	// is being short-circuited for efficiency, but parts of that process are still needed.
	private async hydrate_source_file_from_cache(
		source_file: SourceFile,
		build_config: BuildConfig,
	): Promise<void> {
		// this.log.debug('hydrate', gray(source_file.id));
		const build_files = source_file.build_files.get(build_config);
		if (build_files === undefined) {
			throw Error(`Expected to find build files when hydrating from cache.`);
		}
		const changes = diff_build_files(build_files, null);
		sync_build_files_to_memory_cache(this.files, changes);
		await this.update_dependencies(source_file, build_files, null, build_config);
	}

	// After building the source file, we need to handle any dependency changes for each build file.
	// Dependencies may be added or removed,
	// and their source files need to be updated with any build config changes.
	// When a dependency is added for this build,
	// if the dependency's source file is not an input to the build config,
	// and it has 1 dependent after the build file is added,
	// they're added for this build,
	// meaning the memory cache is updated and the files are built to disk for the build config.
	// When a dependency is removed for this build,
	// if the dependency's source file is not an input to the build config,
	// and it has 0 dependents after the build file is removed,
	// they're removed for this build,
	// meaning the memory cache is updated and the files are deleted from disk for the build config.
	private async update_dependencies(
		source_file: SourceFile,
		new_build_files: readonly BuildFile[],
		old_build_files: readonly BuildFile[] | null,
		build_config: BuildConfig,
	): Promise<void> {
		if (new_build_files === old_build_files) return;

		const {added_dependencies, removed_dependencies} =
			diff_dependencies(new_build_files, old_build_files) || nulls;

		let promises: Array<Promise<void>> | null = null;

		// handle added dependencies
		if (added_dependencies !== null) {
			for (const added_dependency of added_dependencies) {
				// we create no source file for externals
				if (added_dependency.external) continue;
				const added_source_id = this.map_dependency_to_source_id(
					added_dependency,
					this.build_dir,
					this.paths,
				);
				// ignore dependencies on self - happens with common externals
				if (added_source_id === source_file.id) continue;
				const added_source_file = this.files.get(added_source_id);
				if (added_source_file !== undefined) assert_source_file(added_source_file);
				// import might point to a nonexistent file, ignore those
				if (added_source_file !== undefined) {
					// update `dependents` of the added file
					add_dependent(source_file, added_source_file, build_config, added_dependency);

					// Add source file to build if needed.
					// Externals are handled separately by `updateExternalsSourceFile`, not here,
					// because they're batched for the entire build.
					// If we waited for externals to build before moving on like the normal process,
					// then that could cause cascading externals builds as the dependency tree builds.
					if (!added_source_file.build_configs.has(build_config)) {
						(promises || (promises = [])).push(
							this.add_source_file_to_build(
								added_source_file as SourceFile,
								build_config,
								is_input_to_build_config(added_source_file.id, build_config.input),
							),
						);
					}
				}

				// update `dependencies` of the source file
				add_dependency(source_file, added_source_id, build_config, added_dependency);
			}
		}
		if (removed_dependencies !== null) {
			for (const removed_dependency of removed_dependencies) {
				const removed_source_id = this.map_dependency_to_source_id(
					removed_dependency,
					this.build_dir,
					this.paths,
				);
				// ignore dependencies on self - happens with common externals
				if (removed_source_id === source_file.id) continue;
				const removed_source_file = this.files.get(removed_source_id);
				// import might point to a nonexistent file, ignore them completely
				if (removed_source_file === undefined) continue;
				assert_source_file(removed_source_file);
				if (!removed_source_file.build_configs.has(build_config)) {
					throw Error(`Expected build config ${build_config.name}: ${removed_source_file.id}`);
				}

				// update `dependencies` of the source file
				const dependencies_map = source_file.dependencies.get(build_config);
				if (dependencies_map === undefined) {
					throw Error(`Expected dependencies_map: ${source_file.id}`);
				}
				const dependencies = dependencies_map.get(removed_source_id);
				if (dependencies === undefined) {
					throw Error(`Expected dependencies: ${removed_source_id}: ${source_file.id}`);
				}
				dependencies.delete(removed_dependency.build_id);
				if (dependencies.size === 0) {
					dependencies_map.delete(removed_source_id);
				}

				// update `dependents` of the removed file
				const dependents_map = removed_source_file.dependents.get(build_config);
				if (dependents_map === undefined) {
					throw Error(`Expected dependents_map: ${removed_source_file.id}`);
				}
				const dependents = dependents_map.get(source_file.id);
				if (dependents === undefined) {
					throw Error(`Expected dependents: ${removed_source_file.id}: ${source_file.id}`);
				}
				dependents.delete(removed_dependency.build_id);
				if (dependents.size === 0) {
					dependents_map.delete(source_file.id);
					if (
						dependents_map.size === 0 &&
						!removed_source_file.is_input_to_build_configs?.has(build_config)
					) {
						(promises || (promises = [])).push(
							this.remove_source_file_from_build(removed_source_file, build_config),
						);
					}
				}
			}
		}
		if (promises !== null) await Promise.all(promises); // TODO parallelize with syncing to disk below (in `update_build_files()`)?
	}

	private async destroy_source_id(id: SourceId): Promise<void> {
		const source_file = this.files.get(id);
		assert_source_file(source_file);
		this.log.debug('destroying file', gray(id));
		this.files.delete(id);
		await Promise.all(
			this.build_configs.map((b) =>
				source_file.build_configs.has(b)
					? this.remove_source_file_from_build(source_file, b, false)
					: null,
			),
		);
		// TODO instead of batching like this here, make that concern internal to the source_meta
		// passing `false` above to avoid writing `source_meta` to disk for each build -
		// batch delete it now:
		delete_source_meta(this, source_file.id);
	}
}

const sync_build_files_to_disk = async (changes: BuildFileChange[], log: Logger): Promise<void> => {
	const build_config = changes[0]?.file?.build_config;
	const label = build_config ? print_build_config_label(build_config) : '';
	await Promise.all(
		changes.map(async (change) => {
			const {file} = change;
			let should_output_new_file = false;
			if (change.type === 'added') {
				if (!existsSync(file.id)) {
					// log.debug(label, 'creating build file on disk', gray(file.id));
					should_output_new_file = true;
				} else {
					const existing_content = readFileSync(file.id, 'utf8');
					if (file.content !== existing_content) {
						log.debug(label, 'updating stale build file on disk', gray(file.id));
						should_output_new_file = true;
					} // ...else the build file on disk already matches what's in memory.
					// This can happen if the source file changed but this particular build file did not.
					// Loading the usually-stale content into memory to check before writing is inefficient,
					// but it avoids unnecessary writing to disk and misleadingly updated file stats.
				}
			} else if (change.type === 'updated') {
				if (file.content !== change.old_file.content) {
					log.debug(label, 'updating build file on disk', gray(file.id));
					should_output_new_file = true;
				}
			} else if (change.type === 'removed') {
				log.debug(label, 'deleting build file on disk', gray(file.id));
				return fs.remove(file.id);
			} else {
				throw new UnreachableError(change);
			}
			if (should_output_new_file) {
				mkdirSync(dirname(file.id), {recursive: true});
				writeFileSync(file.id, file.content);
			}
		}),
	);
};

const sync_build_files_to_memory_cache = (
	build_files: Map<FilerFileId, FilerFile>,
	changes: BuildFileChange[],
): void => {
	for (const change of changes) {
		if (change.type === 'added' || change.type === 'updated') {
			build_files.set(change.file.id, change.file);
		} else if (change.type === 'removed') {
			build_files.delete(change.file.id);
		} else {
			throw new UnreachableError(change);
		}
	}
};

// TODO hmm how does this fit in?
type BuildFileChange =
	| {
			type: 'added';
			file: BuildFile;
	  }
	| {
			type: 'updated';
			file: BuildFile;
			old_file: BuildFile;
	  }
	| {
			type: 'removed';
			file: BuildFile;
	  };

// Given `new_files` and `old_files`, returns a description of changes.
// This uses `Array#find` because the arrays are expected to be small,
// because we're currently only using it for individual file builds,
// but that assumption might change and cause this code to be slow.
// TODO maybe change to sets or a better data structure for the usage patterns?
const diff_build_files = (
	new_files: readonly BuildFile[],
	old_files: readonly BuildFile[] | null,
): BuildFileChange[] => {
	let changes: BuildFileChange[];
	if (old_files === null) {
		changes = new_files.map((file) => ({type: 'added', file}));
	} else {
		changes = [];
		for (const old_file of old_files) {
			const new_file = new_files.find((f) => f.id === old_file.id);
			if (new_file !== undefined) {
				changes.push({type: 'updated', old_file, file: new_file});
			} else {
				changes.push({type: 'removed', file: old_file});
			}
		}
		for (const new_file of new_files) {
			if (!old_files.some((f) => f.id === new_file.id)) {
				changes.push({type: 'added', file: new_file});
			}
		}
	}
	return changes;
};

// TODO Revisit these restrictions - the goal right now is to set limits
// to avoid undefined behavior at the cost of flexibility.
// Some of these conditions like nested source_dirs could be fixed
// but there are inefficiencies and possibly some subtle bugs.
const validate_dirs = (source_dirs: string[]): string[] => {
	if (!source_dirs.length) throw Error('No source dirs provided');
	const dirs = source_dirs.map((d) => resolve(d));
	for (const source_dir of dirs) {
		const nested_source_dir = dirs.find((d) => d !== source_dir && source_dir.startsWith(d));
		if (nested_source_dir) {
			throw Error(
				'A source_dir cannot be inside another source_dir: ' +
					`${source_dir} is inside ${nested_source_dir}`,
			);
		}
	}
	return dirs;
};

const add_dependent = (
	dependent_source_file: SourceFile,
	dependency_source_file: SourceFile,
	build_config: BuildConfig,
	added_dependency: BuildDependency,
) => {
	let dependents_map = dependency_source_file.dependents.get(build_config);
	if (dependents_map === undefined) {
		dependency_source_file.dependents.set(build_config, (dependents_map = new Map()));
	}
	let dependents = dependents_map.get(dependent_source_file.id);
	if (dependents === undefined) {
		dependents_map.set(dependent_source_file.id, (dependents = new Map()));
	}
	dependents.set(added_dependency.build_id, added_dependency);
};

const add_dependency = (
	dependent_source_file: SourceFile,
	dependency_source_id: string,
	build_config: BuildConfig,
	added_dependency: BuildDependency,
) => {
	let dependencies_map = dependent_source_file.dependencies.get(build_config);
	if (dependencies_map === undefined) {
		dependent_source_file.dependencies.set(build_config, (dependencies_map = new Map()));
	}
	let dependencies = dependencies_map.get(dependency_source_id);
	if (dependencies === undefined) {
		dependencies_map.set(dependency_source_id, (dependencies = new Map()));
	}
	dependencies.set(added_dependency.build_id, added_dependency);
};

/**
 * Allows easier destructuring of `null`s from potentially error-causing values:
 * `const {a, b} = maybeDestructurable() || nulls;`
 * If `maybeDestructurable()` returns a non-destructurable value,
 * the `|| nulls` ensures `a` and `b` default to `null`.
 */
export const nulls: {[key: string]: null} = new Proxy(
	{},
	{
		get() {
			return null;
		},
	},
);
