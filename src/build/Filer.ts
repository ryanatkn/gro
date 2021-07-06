import {resolve, extname, join} from 'path';
import lexer from 'es-module-lexer';
import {EventEmitter} from 'events';
import type StrictEventEmitter from 'strict-event-emitter-types';
import {nulls, omit_undefined} from '@feltcoop/felt/util/object.js';
import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {gray, red, cyan} from '@feltcoop/felt/util/terminal.js';
import {print_error} from '@feltcoop/felt/util/print.js';
import {wrap} from '@feltcoop/felt/util/async.js';
import type {Omit_Strict, Assignable, Partial_Except} from '@feltcoop/felt/util/types.js';

import type {Filesystem} from '../fs/filesystem.js';
import {create_filer_dir} from '../build/filer_dir.js';
import type {Filer_Dir, Filer_Dir_Change_Callback} from '../build/filer_dir.js';
import {is_input_to_build_config, map_dependency_to_source_id} from './utils.js';
import type {Map_Dependency_To_Source_Id} from './utils.js';
import {EXTERNALS_BUILD_DIR_ROOT_PREFIX, JS_EXTENSION, paths, to_build_out_path} from '../paths.js';
import type {Build, Build_Context, Builder, Builder_State, Build_Result} from './builder.js';
import {infer_encoding} from '../fs/encoding.js';
import type {Encoding} from '../fs/encoding.js';
import {print_build_config_label} from '../build/build_config.js';
import type {Build_Name} from '../build/build_config.js';
import type {Build_Config} from '../build/build_config.js';
import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/default_build_config.js';
import type {Ecma_Script_Target} from './ts_build_helpers.js';
import {strip_base, to_served_dirs} from './served_dir.js';
import type {Served_Dir, Served_Dir_Partial} from './served_dir.js';
import {
	assert_buildable_source_file,
	assert_source_file,
	create_source_file,
} from './source_file.js';
import type {Buildable_Source_File, Source_File} from './source_file.js';
import {create_build_file, diff_dependencies} from './build_file.js';
import type {Build_File} from './build_file.js';
import type {Base_Filer_File} from './base_filer_file.js';
import {load_content} from './load.js';
import {is_external_module} from '../utils/module.js';
import {
	DEFAULT_EXTERNALS_ALIASES,
	EXTERNALS_SOURCE_ID,
	get_externals_builder_state,
	get_externals_build_state,
} from './externals_build_helpers.js';
import type {Externals_Aliases} from './externals_build_helpers.js';
import {queue_externals_build} from './externals_builder.js';
import type {Source_Meta} from './source_meta.js';
import type {Build_Dependency} from './build_dependency.js';
import {
	delete_source_meta,
	update_source_meta,
	clean_source_meta,
	init_source_meta,
} from './source_meta.js';
import type {Path_Filter} from '../fs/path_filter.js';

/*

The `Filer` is at the heart of the build system.

The `Filer` wholly owns its `build_dir`, `./.gro` by default.
If any files or directories change inside it without going through the `Filer`,
it may go into a corrupted state.
Corrupted states can be fixed by turning off the `Filer` and running `gro clean`.

TODO

- add tests (fully modularize as they're added, running tests for host interfaces both in memory and on the filesystem)
- probably silence a lot of the logging (or add `debug` log level?) once tests are added

*/

// The Filer is an `EventEmitter` with the following events:
type Filer_Emitter = StrictEventEmitter<EventEmitter, Filer_Events>;
interface Filer_Events {
	build: {source_file: Source_File; build_config: Build_Config};
}

export type Filer_File = Source_File | Build_File; // TODO or `Directory`?

export interface Options {
	fs: Filesystem;
	dev: boolean;
	builder: Builder | null;
	build_configs: Build_Config[] | null;
	build_dir: string;
	source_dirs: string[];
	served_dirs: Served_Dir[];
	externals_aliases: Externals_Aliases;
	map_dependency_to_source_id: Map_Dependency_To_Source_Id;
	sourcemap: boolean;
	types: boolean;
	target: Ecma_Script_Target;
	watch: boolean;
	watcher_debounce: number | undefined;
	filter: Path_Filter | undefined;
	clean_output_dirs: boolean;
	log: Logger;
}
export type Required_Options = 'fs';
export type Initial_Options = Omit_Strict<
	Partial_Except<Options, Required_Options>,
	'served_dirs'
> & {
	served_dirs?: Served_Dir_Partial[];
};
export const init_options = (opts: Initial_Options): Options => {
	const dev = opts.dev ?? true;
	const build_configs = opts.build_configs || null;
	if (build_configs?.length === 0) {
		throw Error(
			'Filer created with an empty array of build_configs.' +
				' Omit the value or provide `null` if this was intended.',
		);
	}
	const build_dir = opts.build_dir || paths.build; // TODO assumes trailing slash
	const source_dirs = opts.source_dirs ? opts.source_dirs.map((d) => resolve(d)) : [];
	validate_dirs(source_dirs);
	const served_dirs = opts.served_dirs ? to_served_dirs(opts.served_dirs) : [];
	const builder = opts.builder || null;
	if (source_dirs.length) {
		if (!build_configs) {
			throw Error('Filer created with directories to build but no build configs were provided.');
		}
		if (!builder) {
			throw Error('Filer created with directories to build but no builder was provided.');
		}
	} else {
		if (!served_dirs.length) {
			throw Error('Filer created with no directories to build or serve.');
		}
		if (builder) {
			throw Error('Filer created with a builder but no directories to build.');
		}
		if (build_configs) {
			throw Error('Filer created with build configs but no builder was provided.');
		}
	}
	return {
		dev,
		externals_aliases: DEFAULT_EXTERNALS_ALIASES,
		map_dependency_to_source_id,
		sourcemap: true,
		types: !dev,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		watch: true,
		watcher_debounce: undefined,
		filter: undefined,
		clean_output_dirs: true,
		...omit_undefined(opts),
		log: opts.log || new System_Logger(print_log_label('filer')),
		builder,
		build_configs,
		build_dir,
		source_dirs,
		served_dirs,
	};
};

export class Filer extends (EventEmitter as {new (): Filer_Emitter}) implements Build_Context {
	// TODO think about accessors - I'm currently just making things public when I need them here
	private readonly files: Map<string, Filer_File> = new Map();
	private readonly dirs: Filer_Dir[];
	private readonly builder: Builder | null;
	private readonly map_dependency_to_source_id: Map_Dependency_To_Source_Id;

	// These public `Build_Context` properties are available to e.g. builders, helpers, postprocessors.
	// This pattern lets us pass around `this` filer
	// without constantly destructuring and handling long argument lists.
	readonly fs: Filesystem; // TODO I don't like the idea of the filer being associated with a single fs host like this - parameterize instead of putting it on `Build_Context`, probably
	readonly build_configs: readonly Build_Config[] | null;
	readonly build_names: Set<Build_Name> | null;
	// TODO if we loosen the restriction of the filer owning the `.gro` directory,
	// `source_meta` will need to be a shared object --
	// a global cache is too inflexible, because we still want to support multiple independent filers
	readonly source_meta_by_id: Map<string, Source_Meta> = new Map();
	readonly log: Logger;
	readonly build_dir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly types: boolean;
	readonly target: Ecma_Script_Target; // TODO shouldn't build configs have this?
	readonly served_dirs: readonly Served_Dir[];
	readonly externals_aliases: Externals_Aliases; // TODO should this allow aliasing anything? not just externals?
	readonly state: Builder_State = {};
	readonly building_source_files: Set<string> = new Set(); // needed by hacky externals code, used to check if the filer is busy
	// TODO not sure about this
	readonly find_by_id = (id: string): Base_Filer_File | undefined =>
		this.files.get(id) || undefined;

	constructor(opts: Initial_Options) {
		super();
		const {
			fs,
			dev,
			builder,
			build_configs,
			build_dir,
			source_dirs,
			served_dirs,
			externals_aliases,
			map_dependency_to_source_id,
			sourcemap,
			types,
			target,
			watch,
			watcher_debounce,
			filter,
			log,
		} = init_options(opts);
		this.fs = fs;
		this.dev = dev;
		this.builder = builder;
		this.build_configs = build_configs;
		this.build_names = build_configs ? new Set(build_configs.map((b) => b.name)) : null;
		this.build_dir = build_dir;
		this.map_dependency_to_source_id = map_dependency_to_source_id;
		this.externals_aliases = externals_aliases;
		this.sourcemap = sourcemap;
		this.types = types;
		this.target = target;
		this.log = log;
		this.dirs = create_filer_dirs(
			fs,
			source_dirs,
			served_dirs,
			build_dir,
			this.on_dir_change,
			watch,
			watcher_debounce,
			filter,
		);
		this.served_dirs = served_dirs;
		log.trace(cyan('build_configs'), build_configs);
		log.trace(cyan('served_dirs'), served_dirs);
	}

	// Searches for a file matching `path`, limited to the directories that are served.
	async find_by_path(path: string): Promise<Base_Filer_File | undefined> {
		const {files} = this;
		for (const served_dir of this.served_dirs) {
			const id = `${served_dir.root}/${strip_base(path, served_dir.base)}`;
			const file = files.get(id);
			if (file === undefined) {
				this.log.trace(`find_by_path: miss: ${id}`);
			} else {
				this.log.trace(`find_by_path: found: ${id}`);
				return file;
			}
		}
		this.log.trace(`find_by_path: not found: ${path}`);
		return undefined;
	}

	close(): void {
		for (const dir of this.dirs) {
			dir.close();
		}
	}

	private initializing: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.initializing) return this.initializing;
		this.log.trace('init', gray(this.dev ? 'development' : 'production'));
		let finish_initializing: () => void;
		this.initializing = new Promise((r) => (finish_initializing = r));

		await Promise.all([init_source_meta(this), lexer.init]);
		// this.log.trace('inited cache');

		// This initializes all files in the filer's directories, loading them into memory,
		// including files to be served, source files, and build files.
		// Initializing the dirs must be done after `this.init_source_meta`
		// because it creates source files, which need `this.source_meta` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// this.log.trace('inited files');

		// Now that the source meta and source files are loaded into memory,
		// check if any source files have been deleted since the last run.
		await clean_source_meta(this);
		// this.log.trace('cleaned');

		// This initializes the builders. Should be done before the builds are initialized.
		// TODO does this belong in `dir.init`? or parallel with .. what?
		// what data is not yet ready? does this belong inside `init_builds`?
		if (this.build_configs !== null) {
			for (const dir of this.dirs) {
				if (!dir.buildable) continue;
				if (this.builder!.init !== undefined) {
					await this.builder!.init(this);
				}
			}
		}

		// This performs initial source file build, traces deps,
		// and populates the `build_configs` property of all source files.
		await this.init_builds();
		// this.log.trace('inited builds');
		// this.log.info('build_configs', this.build_configs);

		// TODO check if `src/` has any conflicting dirs like `src/externals`

		// this.log.trace(blue('initialized!'));

		finish_initializing!();
	}

	// During initialization, after all files are loaded into memory,
	// this is called to populate the `build_configs` property of all source files.
	// It traces the dependencies starting from each `build_config.input`,
	// building each input source file and populating its `build_configs`,
	// recursively until all dependencies have been handled.
	private async init_builds(): Promise<void> {
		if (this.build_configs === null) return;

		const promises: Promise<void>[] = [];

		const filters: ((id: string) => boolean)[] = [];
		const filter_build_configs: Build_Config[] = [];

		// Iterate through the build config inputs and initialize their files.
		for (const build_config of this.build_configs) {
			for (const input of build_config.input) {
				if (typeof input === 'function') {
					filters.push(input);
					filter_build_configs.push(build_config);
					continue;
				}
				const file = this.files.get(input);
				// TODO this assert throws with a bad error - should print `input`
				try {
					assert_buildable_source_file(file);
				} catch (_err) {
					this.log.error(print_build_config_label(build_config), red('missing input'), input);
					throw Error('Missing input: check the build config and source files for the above input');
				}
				if (!file.build_configs.has(build_config)) {
					promises.push(this.add_source_file_to_build(file, build_config, true));
				}
			}
		}

		// Iterate through the files once and apply the filters to all source files.
		if (filters.length) {
			for (const file of this.files.values()) {
				if (file.type !== 'source' || file.id === EXTERNALS_SOURCE_ID) continue;
				for (let i = 0; i < filters.length; i++) {
					if (filters[i](file.id)) {
						// TODO this error condition may be hit if the `filer_dir` is not buildable, correct?
						// give a better error message if that's the case!
						if (!file.buildable) throw Error(`Expected file to be buildable: ${file.id}`);
						const build_config = filter_build_configs[i];
						if (!file.build_configs.has(build_config)) {
							promises.push(this.add_source_file_to_build(file, build_config, true));
						}
					}
				}
			}
		}

		await Promise.all(promises);
		await this.wait_for_externals(); // because they currently build without blocking the main source file builds (due to constraints TODO fix?)
	}

	// Adds a build config to a source file.
	// The caller is expected to check to avoid duplicates.
	private async add_source_file_to_build(
		source_file: Buildable_Source_File,
		build_config: Build_Config,
		is_input: boolean,
	): Promise<void> {
		// this.log.trace(
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
					source_file as Assignable<Buildable_Source_File, 'is_input_to_build_configs'>
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
		source_file: Buildable_Source_File,
		build_config: Build_Config,
		should_update_source_meta = true,
	): Promise<void> {
		this.log.trace(
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
		const {on_remove} = this.builder!;
		if (on_remove) {
			try {
				await on_remove(source_file, build_config, this);
			} catch (err) {
				this.log.error(
					`${print_build_config_label(build_config)} error while removing source file from builder`,
					print_error(err),
				);
			}
		}

		if (should_update_source_meta) {
			await update_source_meta(this, source_file);
		}
	}

	private on_dir_change: Filer_Dir_Change_Callback = async (change, filer_dir) => {
		const id =
			change.path === EXTERNALS_SOURCE_ID ? EXTERNALS_SOURCE_ID : join(filer_dir.dir, change.path);
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
						change.type !== 'init' &&
						filer_dir.buildable // only needed for types, doing this instead of casting for type safety
					) {
						const file = this.files.get(id);
						assert_buildable_source_file(file);
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
					if (this.build_configs !== null && filer_dir.buildable) {
						// TODO This is weird because we're blindly deleting
						// the directory for all build configs,
						// whether or not they apply for this id.
						// It could be improved by tracking tracking dirs in the Filer
						// and looking up the correct build configs.
						await Promise.all(
							this.build_configs.map((build_config) =>
								this.fs.remove(
									to_build_out_path(this.dev, build_config.name, change.path, this.build_dir),
								),
							),
						);
					}
				} else {
					await this.destroy_source_id(id);
				}
				break;
			}
			default:
				throw new Unreachable_Error(change.type);
		}
	};

	// Initialize a newly created source file's builds.
	// It currently uses a slow brute force search to find dependents.
	private async init_source_file(file: Buildable_Source_File): Promise<void> {
		if (this.build_configs === null) return; // TODO is this right?
		let promises: Promise<void>[] | null = null;
		let dependent_build_configs: Set<Build_Config> | null = null;
		// TODO could be sped up with some caching data structures
		for (const f of this.files.values()) {
			if (f.type !== 'source' || !f.buildable) continue;
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
		let input_build_configs: Set<Build_Config> | null = null;
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

	updating_source_files: Map<string, Promise<boolean>> = new Map();

	// Returns a boolean indicating if the source file should be built.
	// The source file may have been updated or created from a cold cache.
	// It batches calls together, but unlike `build_source_file`, it don't queue them,
	// and instead just returns the pending promise.
	private async update_source_file(id: string, filer_dir: Filer_Dir): Promise<boolean> {
		const updating = this.updating_source_files.get(id);
		if (updating !== undefined) return updating;
		const promise = wrap(async (after) => {
			after(() => this.updating_source_files.delete(id));

			// this.log.trace(`updating source file ${gray(id)}`);
			const source_file = this.files.get(id);
			if (source_file !== undefined) {
				assert_source_file(source_file);
				if (source_file.filer_dir !== filer_dir) {
					// This can happen when watchers overlap, a file picked up by two `Filer_Dir`s.
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

			const external =
				source_file === undefined ? is_external_module(id) : source_file.id === EXTERNALS_SOURCE_ID;

			let extension: string;
			let encoding: Encoding;
			if (source_file !== undefined) {
				extension = source_file.extension;
				encoding = source_file.encoding;
			} else if (external) {
				extension = JS_EXTENSION;
				encoding = 'utf8';
			} else {
				extension = extname(id);
				encoding = infer_encoding(extension);
			}
			const new_source_content = external
				? // TODO doesn't seem we can make this a key derived from the specifiers,
				  // because they're potentially different each build
				  ''
				: await load_content(this.fs, encoding, id);

			if (source_file === undefined) {
				// Memory cache is cold.
				const new_source_file = await create_source_file(
					id,
					encoding,
					extension,
					new_source_content,
					filer_dir,
					this.source_meta_by_id.get(id),
					this,
				);
				this.files.set(id, new_source_file);
				// If the created source file has its build files hydrated from the cache,
				// we assume it doesn't need to be built.
				if (new_source_file.buildable && new_source_file.build_files.size !== 0) {
					return false;
				}
			} else if (are_content_equal(encoding, source_file.content, new_source_content)) {
				// Memory cache is warm and source code hasn't changed, do nothing and exit early!
				return false;
			} else {
				// Memory cache is warm, but content have changed.
				switch (source_file.encoding) {
					case 'utf8':
						source_file.content = new_source_content as string;
						source_file.stats = undefined;
						source_file.content_buffer = undefined;
						source_file.content_hash = undefined;
						break;
					case null:
						source_file.content = new_source_content as Buffer;
						source_file.stats = undefined;
						source_file.content_buffer = new_source_content as Buffer;
						source_file.content_hash = undefined;
						break;
					default:
						throw new Unreachable_Error(source_file);
				}
			}
			return filer_dir.buildable;
		});
		this.updating_source_files.set(id, promise);
		return promise;
	}

	// These are used to avoid concurrent builds for any given source file.
	// TODO maybe make these `Map<Build_Config, Set<Buildable_Source_File>>`, initialize during `init` to avoid bookkeeping API overhead or speciality code
	private pending_builds: Map<Build_Config, Set<string>> = new Map(); // value is source_id
	private enqueued_builds: Map<Build_Config, Set<string>> = new Map(); // value is source_id

	// This wrapper function protects against race conditions
	// that could occur with concurrent builds.
	// If a file is currently being build, it enqueues the file id,
	// and when the current build finishes,
	// it removes the item from the queue and rebuilds the file.
	// The queue stores at most one build per file,
	// and this is safe given that building accepts no parameters.
	private async build_source_file(
		source_file: Buildable_Source_File,
		build_config: Build_Config,
	): Promise<void> {
		let pending_builds = this.pending_builds.get(build_config);
		if (pending_builds === undefined) {
			pending_builds = new Set();
			this.pending_builds.set(build_config, pending_builds);
		}
		let enqueued_builds = this.enqueued_builds.get(build_config);
		if (enqueued_builds === undefined) {
			enqueued_builds = new Set();
			this.enqueued_builds.set(build_config, enqueued_builds);
		}

		const {id} = source_file;
		if (pending_builds.has(id)) {
			enqueued_builds.add(id);
			return;
		}
		pending_builds.add(id);
		try {
			await this._build_source_file(source_file, build_config);
			this.emit('build', {source_file, build_config});
		} catch (err) {
			this.log.error(
				print_build_config_label(build_config),
				red('build failed'),
				gray(id),
				print_error(err),
			);
			// TODO probably want to track this failure data
		}
		pending_builds.delete(id);
		if (enqueued_builds.has(id)) {
			enqueued_builds.delete(id);
			// Something changed during the build for this file, so recurse.
			// This sequencing ensures that any awaiting callers always see the final version.
			// TODO do we need to detect cycles? if we run into any, probably
			// TODO this is wasteful - we could get the previous source file's content by adding a var above,
			// but `update_source_file` loads the content from disk -
			// however I'd rather optimize this only after tests are in place.
			const should_build = await this.update_source_file(id, source_file.filer_dir);
			if (should_build) {
				await this.build_source_file(source_file, build_config);
			}
		}
	}

	private async _build_source_file(
		source_file: Buildable_Source_File,
		build_config: Build_Config,
	): Promise<void> {
		this.log.info(
			`${print_build_config_label(build_config)} build source file`,
			gray(source_file.id),
		);

		// Compile the source file.
		let result: Build_Result<Build>;

		this.building_source_files.add(source_file.id); // track so we can see what the filer is doing
		try {
			result = await this.builder!.build(source_file, build_config, this);
		} catch (err) {
			this.building_source_files.delete(source_file.id);
			throw err;
		}
		this.building_source_files.delete(source_file.id);

		const newBuild_Files: Build_File[] = result.builds.map((build) =>
			create_build_file(build, this, result, source_file, build_config),
		);

		// Update the source file with the new build files.
		await this.update_build_files(source_file, newBuild_Files, build_config);
		await update_source_meta(this, source_file);
	}

	// Updates the build files in the memory cache and writes to disk.
	private async update_build_files(
		source_file: Buildable_Source_File,
		newBuild_Files: Build_File[],
		build_config: Build_Config,
	): Promise<void> {
		const oldBuild_Files = source_file.build_files.get(build_config) || null;
		const changes = diff_build_files(newBuild_Files, oldBuild_Files);
		source_file.build_files.set(build_config, newBuild_Files);
		sync_build_files_to_memory_cache(this.files, changes);
		await Promise.all([
			sync_build_files_to_disk(this.fs, changes, this.log),
			this.updateDependencies(source_file, newBuild_Files, oldBuild_Files, build_config),
		]);
	}

	// This is like `update_build_files` except
	// it's called for source files when they're being hydrated from the cache.
	// This is because the normal build process ending with `update_build_files`
	// is being short-circuited for efficiency, but parts of that process are still needed.
	private async hydrate_source_file_from_cache(
		source_file: Buildable_Source_File,
		build_config: Build_Config,
	): Promise<void> {
		// this.log.trace('hydrate', gray(source_file.id));
		const build_files = source_file.build_files.get(build_config);
		if (build_files === undefined) {
			throw Error(`Expected to find build files when hydrating from cache.`);
		}
		const changes = diff_build_files(build_files, null);
		sync_build_files_to_memory_cache(this.files, changes);
		await this.updateDependencies(source_file, build_files, null, build_config);
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
	private async updateDependencies(
		source_file: Buildable_Source_File,
		newBuild_Files: readonly Build_File[],
		oldBuild_Files: readonly Build_File[] | null,
		build_config: Build_Config,
	): Promise<void> {
		if (newBuild_Files === oldBuild_Files) return;

		const {added_dependencies, removed_dependencies} =
			diff_dependencies(newBuild_Files, oldBuild_Files) || nulls;

		let promises: Promise<void>[] | null = null;

		// handle added dependencies
		if (added_dependencies !== null) {
			for (const added_dependency of added_dependencies) {
				// `external` will be false for Node imports in non-browser contexts -
				// we create no source file for them
				if (!added_dependency.external && is_external_module(added_dependency.build_id)) continue;
				const added_source_id = this.map_dependency_to_source_id(added_dependency, this.build_dir);
				// ignore dependencies on self - happens with common externals
				if (added_source_id === source_file.id) continue;
				let addedSource_File = this.files.get(added_source_id);
				if (addedSource_File !== undefined) assert_buildable_source_file(addedSource_File);
				// lazily create external source file if needed
				if (added_dependency.external) {
					if (addedSource_File === undefined) {
						addedSource_File = await this.createExternalsSource_File(source_file.filer_dir);
					}
					this.update_externals_source_file(addedSource_File, added_dependency, build_config);
				}
				// import might point to a nonexistent file, ignore those
				if (addedSource_File !== undefined) {
					// update `dependents` of the added file
					add_dependent(source_file, addedSource_File, build_config, added_dependency);

					// Add source file to build if needed.
					// Externals are handled separately by `update_externals_source_file`, not here,
					// because they're batched for the entire build.
					// If we waited for externals to build before moving on like the normal process,
					// then that could cause cascading externals builds as the dependency tree builds.
					if (!addedSource_File.build_configs.has(build_config) && !added_dependency.external) {
						(promises || (promises = [])).push(
							this.add_source_file_to_build(
								addedSource_File as Buildable_Source_File,
								build_config,
								is_input_to_build_config(addedSource_File.id, build_config.input),
							),
						);
					}
				}

				// update `dependencies` of the source file
				add_dependency(source_file, added_source_id, build_config, added_dependency);
			}
		}
		if (removed_dependencies !== null) {
			for (const removedDependency of removed_dependencies) {
				const removed_source_id = this.map_dependency_to_source_id(
					removedDependency,
					this.build_dir,
				);
				// ignore dependencies on self - happens with common externals
				if (removed_source_id === source_file.id) continue;
				const removedSource_File = this.files.get(removed_source_id);
				// import might point to a nonexistent file, ignore them completely
				if (removedSource_File === undefined) continue;
				assert_buildable_source_file(removedSource_File);
				if (!removedSource_File.build_configs.has(build_config)) {
					throw Error(`Expected build config ${build_config.name}: ${removedSource_File.id}`);
				}

				// update `dependencies` of the source file
				let dependencies_map = source_file.dependencies.get(build_config);
				if (dependencies_map === undefined) {
					throw Error(`Expected dependencies_map: ${source_file.id}`);
				}
				let dependencies = dependencies_map.get(removed_source_id);
				if (dependencies === undefined) {
					throw Error(`Expected dependencies: ${removed_source_id}: ${source_file.id}`);
				}
				dependencies.delete(removedDependency.build_id);
				if (dependencies.size === 0) {
					dependencies_map.delete(removed_source_id);
				}

				// update `dependents` of the removed file
				let dependents_map = removedSource_File.dependents.get(build_config);
				if (dependents_map === undefined) {
					throw Error(`Expected dependents_map: ${removedSource_File.id}`);
				}
				let dependents = dependents_map.get(source_file.id);
				if (dependents === undefined) {
					throw Error(`Expected dependents: ${removedSource_File.id}: ${source_file.id}`);
				}
				dependents.delete(removedDependency.build_id);
				if (dependents.size === 0) {
					dependents_map.delete(source_file.id);
					if (
						dependents_map.size === 0 &&
						!removedSource_File.is_input_to_build_configs?.has(build_config) &&
						!removedDependency.external // TODO ignoring these for now, would be weird to remove only when it has none, but not handle other removals (maybe it should handle them?)
					) {
						(promises || (promises = [])).push(
							this.remove_source_file_from_build(removedSource_File, build_config),
						);
					}
				}
			}
		}
		if (promises !== null) await Promise.all(promises); // TODO parallelize with syncing to disk below (in `update_build_files()`)?
	}

	private async destroy_source_id(id: string): Promise<void> {
		const source_file = this.files.get(id);
		assert_source_file(source_file);
		this.log.trace('destroying file', gray(id));
		this.files.delete(id);
		if (source_file.buildable) {
			if (this.build_configs !== null) {
				await Promise.all(
					this.build_configs.map((b) =>
						source_file.build_configs.has(b)
							? this.remove_source_file_from_build(source_file, b, false)
							: null,
					),
				);
			}
			// passing `false` above to avoid writing `source_meta` to disk for each build -
			// batch delete it now:
			await delete_source_meta(this, source_file.id);
		}
	}

	// TODO can we remove `createExternalsSource_File`, treating externals like all others?
	// It seems not, because the `Filer` currently does not handle multiple source files
	// per build, it's 1:N not M:N, and further the externals build lazily,
	// so we probably need to refactor, ultimately into a plugin system.
	private creatingExternalsSource_File: Promise<Buildable_Source_File> | undefined;
	private async createExternalsSource_File(filer_dir: Filer_Dir): Promise<Buildable_Source_File> {
		return (
			this.creatingExternalsSource_File ||
			(this.creatingExternalsSource_File = (async () => {
				const id = EXTERNALS_SOURCE_ID;
				// this.log.trace('creating external source file', gray(id));
				if (this.files.has(id)) throw Error(`Expected to create source file: ${id}`);
				await this.update_source_file(id, filer_dir);
				const source_file = this.files.get(id);
				assert_buildable_source_file(source_file);
				// TODO why is this needed for the client to work in the browser?
				// shouldn't it be taken care of through the normal externals update?
				// it's duplicating the work of `add_source_file_to_build`
				if (source_file.build_files.size > 0) {
					await Promise.all(
						Array.from(source_file.build_files.keys()).map(
							(build_config) => (
								// TODO this is weird because we're hydrating but not building.
								// and we're not adding to the build either - see comments above for more
								source_file.build_configs.add(build_config),
								this.hydrate_source_file_from_cache(source_file, build_config)
							),
						),
					);
				}
				return source_file;
			})())
		);
	}

	// TODO try to refactor this, maybe merge into `update_source_file`?
	// TODO basically..what we want, is when a file is finished building,
	// we want some callback logic to run - the logic is like,
	// "if there are no other pending builds other than this one, proceed with the externals build"
	// the problem is the builds are recursively depth-first!
	// so we can't wait til it's "idle", because it's never idle until everything is built.
	private update_externals_source_file(
		source_file: Buildable_Source_File,
		added_dependency: Build_Dependency,
		build_config: Build_Config,
	): Promise<void> | null {
		const {specifier} = added_dependency;
		if (specifier.startsWith(EXTERNALS_BUILD_DIR_ROOT_PREFIX)) return null;
		const build_state = get_externals_build_state(
			get_externals_builder_state(this.state),
			build_config,
		);
		if (!build_state.specifiers.has(specifier)) {
			build_state.specifiers.add(specifier);
			const updating = queue_externals_build(
				source_file.id,
				build_state,
				this.building_source_files,
				this.log,
				async () => {
					if (source_file.build_configs.has(build_config)) {
						await this.build_source_file(source_file, build_config);
					} else {
						source_file.dirty = true; // force it to build
						await this.add_source_file_to_build(source_file, build_config, false);
					}
				},
			);
			this.updating_externals.push(updating);
			return updating;
		}
		return null;
	}
	// TODO this could possibly be changed to explicitly call the build,
	// instead of waiting with timeouts in places,
	// and it'd be specific to one ExternalsBuildState, so it'd be per build config.
	// we could then remove things like the tracking what's building in the Filer and externalsBuidler
	private updating_externals: Promise<void>[] = [];
	private async wait_for_externals(): Promise<void> {
		if (!this.updating_externals.length) return;
		await Promise.all(this.updating_externals);
		this.updating_externals.length = 0;
	}
}

const sync_build_files_to_disk = async (
	fs: Filesystem,
	changes: Build_FileChange[],
	log: Logger,
): Promise<void> => {
	const build_config = changes[0]?.file?.build_config;
	const label = build_config ? print_build_config_label(build_config) : '';
	await Promise.all(
		changes.map(async (change) => {
			const {file} = change;
			let should_output_new_file = false;
			if (change.type === 'added') {
				if (!(await fs.exists(file.id))) {
					// log.trace(label, 'creating build file on disk', gray(file.id));
					should_output_new_file = true;
				} else {
					const existing_content = await load_content(fs, file.encoding, file.id);
					if (!are_content_equal(file.encoding, file.content, existing_content)) {
						log.trace(label, 'updating stale build file on disk', gray(file.id));
						should_output_new_file = true;
					} // ...else the build file on disk already matches what's in memory.
					// This can happen if the source file changed but this particular build file did not.
					// Loading the usually-stale content into memory to check before writing is inefficient,
					// but it avoids unnecessary writing to disk and misleadingly updated file stats.
				}
			} else if (change.type === 'updated') {
				if (!are_content_equal(file.encoding, file.content, change.old_file.content)) {
					log.trace(label, 'updating build file on disk', gray(file.id));
					should_output_new_file = true;
				}
			} else if (change.type === 'removed') {
				log.trace(label, 'deleting build file on disk', gray(file.id));
				return fs.remove(file.id);
			} else {
				throw new Unreachable_Error(change);
			}
			if (should_output_new_file) {
				await fs.write_file(file.id, file.content);
			}
		}),
	);
};

const sync_build_files_to_memory_cache = (
	files: Map<string, Filer_File>,
	changes: Build_FileChange[],
): void => {
	for (const change of changes) {
		if (change.type === 'added' || change.type === 'updated') {
			files.set(change.file.id, change.file);
		} else if (change.type === 'removed') {
			files.delete(change.file.id);
		} else {
			throw new Unreachable_Error(change);
		}
	}
};

// TODO hmm how does this fit in?
type Build_FileChange =
	| {
			type: 'added';
			file: Build_File;
	  }
	| {
			type: 'updated';
			file: Build_File;
			old_file: Build_File;
	  }
	| {
			type: 'removed';
			file: Build_File;
	  };

// Given `new_files` and `old_files`, returns a description of changes.
// This uses `Array#find` because the arrays are expected to be small,
// because we're currently only using it for individual file builds,
// but that assumption might change and cause this code to be slow.
// TODO maybe change to sets or a better data structure for the usage patterns?
const diff_build_files = (
	new_files: readonly Build_File[],
	old_files: readonly Build_File[] | null,
): Build_FileChange[] => {
	let changes: Build_FileChange[];
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

const are_content_equal = (encoding: Encoding, a: string | Buffer, b: string | Buffer): boolean => {
	switch (encoding) {
		case 'utf8':
			return a === b;
		case null:
			return (a as Buffer).equals(b as Buffer);
		default:
			throw new Unreachable_Error(encoding);
	}
};

// TODO Revisit these restrictions - the goal right now is to set limits
// to avoid undefined behavior at the cost of flexibility.
// Some of these conditions like nested source_dirs could be fixed
// but there are inefficiencies and possibly some subtle bugs.
const validate_dirs = (source_dirs: string[]) => {
	for (const source_dir of source_dirs) {
		const nested_source_dir = source_dirs.find((d) => d !== source_dir && source_dir.startsWith(d));
		if (nested_source_dir) {
			throw Error(
				'A source_dir cannot be inside another source_dir: ' +
					`${source_dir} is inside ${nested_source_dir}`,
			);
		}
	}
};

// Creates objects to load a directory's content and sync filesystem changes in memory.
// The order of objects in the returned array is meaningless.
const create_filer_dirs = (
	fs: Filesystem,
	source_dirs: string[],
	served_dirs: Served_Dir[],
	build_dir: string,
	on_change: Filer_Dir_Change_Callback,
	watch: boolean,
	watcher_debounce: number | undefined,
	filter: Path_Filter | undefined,
): Filer_Dir[] => {
	const dirs: Filer_Dir[] = [];
	for (const source_dir of source_dirs) {
		dirs.push(create_filer_dir(fs, source_dir, true, on_change, watch, watcher_debounce, filter));
	}
	for (const served_dir of served_dirs) {
		// If a `served_dir` is inside a source or externals directory,
		// it's already in the Filer's memory cache and does not need to be loaded as a directory.
		// Additionally, the same is true for `served_dir`s that are inside other `served_dir`s.
		if (
			// TODO I think these are bugged with trailing slashes -
			// note the `served_dir.dir` of `served_dir.dir.startsWith` could also not have a trailing slash!
			// so I think you add `{dir} + '/'` to both?
			!source_dirs.find((d) => served_dir.path.startsWith(d)) &&
			!served_dirs.find((d) => d !== served_dir && served_dir.path.startsWith(d.path)) &&
			!served_dir.path.startsWith(build_dir)
		) {
			dirs.push(
				create_filer_dir(fs, served_dir.path, false, on_change, watch, watcher_debounce, filter),
			);
		}
	}
	return dirs;
};

const add_dependent = (
	dependent_source_file: Buildable_Source_File,
	dependency_source_file: Buildable_Source_File,
	build_config: Build_Config,
	added_dependency: Build_Dependency,
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
	dependent_source_file: Buildable_Source_File,
	dependency_source_id: string,
	build_config: Build_Config,
	added_dependency: Build_Dependency,
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
