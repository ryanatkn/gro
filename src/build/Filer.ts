import {resolve, extname, join} from 'path';
import lexer from 'es-module-lexer';
import {EventEmitter} from 'events';
import type StrictEventEmitter from 'strict-event-emitter-types';
import {nulls, omitUndefined} from '@feltcoop/felt/utils/object.js';
import {Unreachable_Error} from '@feltcoop/felt/utils/error.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/utils/log.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {gray, red, cyan} from '@feltcoop/felt/utils/terminal.js';
import {print_error} from '@feltcoop/felt/utils/print.js';
import {wrap} from '@feltcoop/felt/utils/async.js';
import type {OmitStrict, Assignable, PartialExcept} from '@feltcoop/felt/utils/types.js';

import type {Filesystem} from '../fs/filesystem.js';
import {createFilerDir} from '../build/filerDir.js';
import type {FilerDir, FilerDirChangeCallback} from '../build/filerDir.js';
import {is_input_to_build_config, map_dependency_to_source_id} from './utils.js';
import type {Map_Dependency_To_Source_Id} from './utils.js';
import {EXTERNALS_BUILD_DIR_ROOT_PREFIX, JS_EXTENSION, paths, to_build_out_path} from '../paths.js';
import type {
	Build,
	BuildContext,
	BuildDependency,
	Builder,
	BuilderState,
	BuildResult,
} from './builder.js';
import {inferEncoding} from '../fs/encoding.js';
import type {Encoding} from '../fs/encoding.js';
import {is_system_build_config, print_build_config_label} from '../build/build_config.js';
import type {Build_Config} from '../build/build_config.js';
import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/default_build_config.js';
import type {EcmaScriptTarget} from './tsBuildHelpers.js';
import {stripBase, toServedDirs} from './served_dir.js';
import type {ServedDir, Served_Dir_Partial} from './served_dir.js';
import {assertBuildableSourceFile, assertSourceFile, createSourceFile} from './sourceFile.js';
import type {BuildableSourceFile, SourceFile} from './sourceFile.js';
import {createBuildFile, diffDependencies} from './buildFile.js';
import type {BuildFile} from './buildFile.js';
import type {BaseFilerFile} from './baseFilerFile.js';
import {loadContents} from './load.js';
import {isExternalBrowserModule} from '../utils/module.js';
import {
	DEFAULT_EXTERNALS_ALIASES,
	EXTERNALS_SOURCE_ID,
	getExternalsBuilderState,
	getExternalsBuildState,
} from './externalsBuildHelpers.js';
import type {ExternalsAliases} from './externalsBuildHelpers.js';
import {queueExternalsBuild} from './externalsBuilder.js';
import type {SourceMeta} from './source_meta.js';
import {
	deleteSourceMeta,
	updateSourceMeta,
	cleanSourceMeta,
	initSourceMeta,
} from './source_meta.js';
import type {PathFilter} from '../fs/pathFilter.js';

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
type FilerEmitter = StrictEventEmitter<EventEmitter, FilerEvents>;
interface FilerEvents {
	build: {sourceFile: SourceFile; build_config: Build_Config};
}

export type FilerFile = SourceFile | BuildFile; // TODO or `Directory`?

export interface Options {
	fs: Filesystem;
	dev: boolean;
	builder: Builder | null;
	build_configs: Build_Config[] | null;
	build_dir: string;
	sourceDirs: string[];
	served_dirs: ServedDir[];
	externalsAliases: ExternalsAliases;
	map_dependency_to_source_id: Map_Dependency_To_Source_Id;
	sourcemap: boolean;
	target: EcmaScriptTarget;
	watch: boolean;
	watcherDebounce: number | undefined;
	filter: PathFilter | undefined;
	cleanOutputDirs: boolean;
	log: Logger;
}
export type RequiredOptions = 'fs';
export type InitialOptions = OmitStrict<PartialExcept<Options, RequiredOptions>, 'served_dirs'> & {
	served_dirs?: Served_Dir_Partial[];
};
export const initOptions = (opts: InitialOptions): Options => {
	const dev = opts.dev ?? true;
	const build_configs = opts.build_configs || null;
	if (build_configs?.length === 0) {
		throw Error(
			'Filer created with an empty array of build_configs.' +
				' Omit the value or provide `null` if this was intended.',
		);
	}
	const build_dir = opts.build_dir || paths.build; // TODO assumes trailing slash
	const sourceDirs = opts.sourceDirs ? opts.sourceDirs.map((d) => resolve(d)) : [];
	validateDirs(sourceDirs);
	const served_dirs = toServedDirs(
		opts.served_dirs ||
			(build_configs === null
				? []
				: [
						// default to a best guess
						to_build_out_path(
							dev,
							(
								build_configs.find((c) => c.platform === 'browser') ||
								build_configs.find((c) => is_system_build_config(c))!
							).name,
							'',
							build_dir,
						),
				  ]),
	);
	const builder = opts.builder || null;
	if (sourceDirs.length) {
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
		externalsAliases: DEFAULT_EXTERNALS_ALIASES,
		map_dependency_to_source_id,
		sourcemap: true,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		watch: true,
		watcherDebounce: undefined,
		filter: undefined,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		log: opts.log || new System_Logger(print_log_label('filer')),
		builder,
		build_configs,
		build_dir,
		sourceDirs,
		served_dirs,
	};
};

export class Filer extends (EventEmitter as {new (): FilerEmitter}) implements BuildContext {
	// TODO think about accessors - I'm currently just making things public when I need them here
	private readonly files: Map<string, FilerFile> = new Map();
	private readonly fileExists: (id: string) => boolean = (id) => this.files.has(id);
	private readonly dirs: FilerDir[];
	private readonly builder: Builder | null;
	private readonly map_dependency_to_source_id: Map_Dependency_To_Source_Id;

	// These public `BuildContext` properties are available to e.g. builders, helpers, postprocessors.
	// This pattern lets us pass around `this` filer
	// without constantly destructuring and handling long argument lists.
	readonly fs: Filesystem; // TODO I don't like the idea of the filer being associated with a single fs host like this - parameterize instead of putting it on `BuildContext`, probably
	readonly build_configs: readonly Build_Config[] | null;
	readonly source_metaById: Map<string, SourceMeta> = new Map();
	readonly log: Logger;
	readonly build_dir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget; // TODO shouldn't build configs have this?
	readonly served_dirs: readonly ServedDir[];
	readonly externalsAliases: ExternalsAliases; // TODO should this allow aliasing anything? not just externals?
	readonly state: BuilderState = {};
	readonly buildingSourceFiles: Set<string> = new Set(); // needed by hacky externals code, used to check if the filer is busy
	// TODO not sure about this
	readonly findById = (id: string): BaseFilerFile | undefined => this.files.get(id) || undefined;

	constructor(opts: InitialOptions) {
		super();
		const {
			fs,
			dev,
			builder,
			build_configs,
			build_dir,
			sourceDirs,
			served_dirs,
			externalsAliases,
			map_dependency_to_source_id,
			sourcemap,
			target,
			watch,
			watcherDebounce,
			filter,
			log,
		} = initOptions(opts);
		this.fs = fs;
		this.dev = dev;
		this.builder = builder;
		this.build_configs = build_configs;
		this.build_dir = build_dir;
		this.map_dependency_to_source_id = map_dependency_to_source_id;
		this.externalsAliases = externalsAliases;
		this.sourcemap = sourcemap;
		this.target = target;
		this.log = log;
		this.dirs = createFilerDirs(
			fs,
			sourceDirs,
			served_dirs,
			build_dir,
			this.onDirChange,
			watch,
			watcherDebounce,
			filter,
		);
		this.served_dirs = served_dirs;
		log.trace(cyan('build_configs\n'), build_configs);
		log.trace(cyan('served_dirs\n'), served_dirs);
	}

	// Searches for a file matching `path`, limited to the directories that are served.
	async findByPath(path: string): Promise<BaseFilerFile | undefined> {
		const {files} = this;
		for (const served_dir of this.served_dirs) {
			const id = `${served_dir.root}/${stripBase(path, served_dir.base)}`;
			const file = files.get(id);
			if (file === undefined) {
				this.log.trace(`findByPath: miss: ${id}`);
			} else {
				this.log.trace(`findByPath: found: ${id}`);
				return file;
			}
		}
		this.log.trace(`findByPath: not found: ${path}`);
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
		this.log.trace('init');
		let finishInitializing: () => void;
		this.initializing = new Promise((r) => (finishInitializing = r));

		await Promise.all([initSourceMeta(this), lexer.init]);
		// this.log.trace('inited cache');

		// This initializes all files in the filer's directories, loading them into memory,
		// including files to be served, source files, and build files.
		// Initializing the dirs must be done after `this.initSourceMeta`
		// because it creates source files, which need `this.source_meta` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// this.log.trace('inited files');

		// Now that the source meta and source files are loaded into memory,
		// check if any source files have been deleted since the last run.
		await cleanSourceMeta(this, this.fileExists);
		// this.log.trace('cleaned');

		// This initializes the builders. Should be done before the builds are initialized.
		// TODO does this belong in `dir.init`? or parallel with .. what?
		// what data is not yet ready? does this belong inside `initBuilds`?
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
		await this.initBuilds();
		// this.log.trace('inited builds');
		// this.log.info('build_configs', this.build_configs);

		// TODO check if `src/` has any conflicting dirs like `src/externals`

		// this.log.trace(blue('initialized!'));

		finishInitializing!();
	}

	// During initialization, after all files are loaded into memory,
	// this is called to populate the `build_configs` property of all source files.
	// It traces the dependencies starting from each `build_config.input`,
	// building each input source file and populating its `build_configs`,
	// recursively until all dependencies have been handled.
	private async initBuilds(): Promise<void> {
		if (this.build_configs === null) return;

		const promises: Promise<void>[] = [];

		const filters: ((id: string) => boolean)[] = [];
		const filterBuild_Configs: Build_Config[] = [];

		// Iterate through the build config inputs and initialize their files.
		for (const build_config of this.build_configs) {
			for (const input of build_config.input) {
				if (typeof input === 'function') {
					filters.push(input);
					filterBuild_Configs.push(build_config);
					continue;
				}
				const file = this.files.get(input);
				// TODO this assert throws with a bad error - should print `input`
				try {
					assertBuildableSourceFile(file);
				} catch (_err) {
					this.log.error(print_build_config_label(build_config), red('missing input'), input);
					throw Error('Missing input: check the build config and source files for the above input');
				}
				if (!file.build_configs.has(build_config)) {
					promises.push(this.addSourceFileToBuild(file, build_config, true));
				}
			}
		}

		// Iterate through the files once and apply the filters to all source files.
		if (filters.length) {
			for (const file of this.files.values()) {
				if (file.type !== 'source' || file.id === EXTERNALS_SOURCE_ID) continue;
				for (let i = 0; i < filters.length; i++) {
					if (filters[i](file.id)) {
						// TODO this error condition may be hit if the `filerDir` is not buildable, correct?
						// give a better error message if that's the case!
						if (!file.buildable) throw Error(`Expected file to be buildable: ${file.id}`);
						const build_config = filterBuild_Configs[i];
						if (!file.build_configs.has(build_config)) {
							promises.push(this.addSourceFileToBuild(file, build_config, true));
						}
					}
				}
			}
		}

		await Promise.all(promises);
		await this.waitForExternals(); // because they currently build without blocking the main source file builds (due to constraints TODO fix?)
	}

	// Adds a build config to a source file.
	// The caller is expected to check to avoid duplicates.
	private async addSourceFileToBuild(
		sourceFile: BuildableSourceFile,
		build_config: Build_Config,
		isInput: boolean,
	): Promise<void> {
		// this.log.trace(
		// 	`adding source file to build ${print_build_config_label(build_config)} ${gray(sourceFile.id)}`,
		// );
		if (sourceFile.build_configs.has(build_config)) {
			throw Error(`Already has build_config ${build_config.name}: ${gray(sourceFile.id)}`);
		}
		// Add the build config. The caller is expected to check to avoid duplicates.
		sourceFile.build_configs.add(build_config);
		// Add the build config as an input if appropriate, initializing the set if needed.
		// We need to determine `is_input_to_build_config` independently of the caller,
		// because the caller may not
		if (isInput) {
			if (sourceFile.is_input_to_build_configs === null) {
				// Cast to keep the `readonly` modifier outside of initialization.
				(sourceFile as Assignable<
					BuildableSourceFile,
					'is_input_to_build_configs'
				>).is_input_to_build_configs = new Set();
			}
			sourceFile.is_input_to_build_configs!.add(build_config);
		}

		// Build only if needed - build files may be hydrated from the cache.
		const hasBuild_Config = sourceFile.buildFiles.has(build_config);
		if (hasBuild_Config) {
			await this.hydrateSourceFileFromCache(sourceFile, build_config);
		}
		const {dirty} = sourceFile;
		if (!hasBuild_Config || dirty) {
			await this.buildSourceFile(sourceFile, build_config);
			if (dirty) sourceFile.dirty = false;
		}
	}

	// Removes a build config from a source file.
	// The caller is expected to check to avoid duplicates.
	private async removeSourceFileFromBuild(
		sourceFile: BuildableSourceFile,
		build_config: Build_Config,
		shouldUpdateSourceMeta = true,
	): Promise<void> {
		this.log.trace(
			`${print_build_config_label(build_config)} removing source file ${gray(sourceFile.id)}`,
		);

		await this.updateBuildFiles(sourceFile, [], build_config);

		const deleted = sourceFile.build_configs.delete(build_config);
		if (!deleted) {
			throw Error(`Expected to delete build_config ${build_config.name}: ${sourceFile.id}`);
		}
		const deletedBuildFiles = sourceFile.buildFiles.delete(build_config);
		if (!deletedBuildFiles) {
			throw Error(`Expected to delete build files ${build_config.name}: ${sourceFile.id}`);
		}
		sourceFile.dependencies.delete(build_config);
		sourceFile.dependents.delete(build_config);
		const {onRemove} = this.builder!;
		if (onRemove) {
			try {
				await onRemove(sourceFile, build_config, this);
			} catch (err) {
				this.log.error(
					`${print_build_config_label(build_config)} error while removing source file from builder`,
					print_error(err),
				);
			}
		}

		if (shouldUpdateSourceMeta) {
			await updateSourceMeta(this, sourceFile);
		}
	}

	private onDirChange: FilerDirChangeCallback = async (change, filerDir) => {
		const id =
			change.path === EXTERNALS_SOURCE_ID ? EXTERNALS_SOURCE_ID : join(filerDir.dir, change.path);
		// console.log(red(change.type), id); // TODO maybe make an even more verbose log level for this?
		switch (change.type) {
			case 'init':
			case 'create':
			case 'update': {
				if (change.stats.isDirectory()) {
					// We could ensure the directory, but it's usually wasted work,
					// and `fs-extra` takes care of adding missing directories when writing to disk.
				} else {
					const shouldBuild = await this.updateSourceFile(id, filerDir);
					if (
						shouldBuild &&
						// When initializing, building is deferred to `initBuilds`
						// so that deps are determined in the correct order.
						change.type !== 'init' &&
						filerDir.buildable // only needed for types, doing this instead of casting for type safety
					) {
						const file = this.files.get(id);
						assertBuildableSourceFile(file);
						if (change.type === 'create') {
							await this.initSourceFile(file);
						} else {
							await Promise.all(
								Array.from(file.build_configs).map((build_config) =>
									this.buildSourceFile(file, build_config),
								),
							);
						}
					}
				}
				break;
			}
			case 'delete': {
				if (change.stats.isDirectory()) {
					if (this.build_configs !== null && filerDir.buildable) {
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
					await this.destroySourceId(id);
				}
				break;
			}
			default:
				throw new Unreachable_Error(change.type);
		}
	};

	// Initialize a newly created source file's builds.
	// It currently uses a slow brute force search to find dependents.
	private async initSourceFile(file: BuildableSourceFile): Promise<void> {
		if (this.build_configs === null) return; // TODO is this right?
		let promises: Promise<void>[] | null = null;
		let dependentBuild_Configs: Set<Build_Config> | null = null;
		// TODO could be sped up with some caching data structures
		for (const f of this.files.values()) {
			if (f.type !== 'source' || !f.buildable) continue;
			for (const [build_config, dependenciesMap] of f.dependencies) {
				if (dependenciesMap.has(file.id)) {
					const dependencies = dependenciesMap.get(file.id)!;
					for (const dependency of dependencies.values()) {
						addDependent(f, file, build_config, dependency);
					}
					(dependentBuild_Configs || (dependentBuild_Configs = new Set())).add(build_config);
				}
			}
		}
		let inputBuild_Configs: Set<Build_Config> | null = null;
		for (const build_config of this.build_configs) {
			if (is_input_to_build_config(file.id, build_config.input)) {
				(inputBuild_Configs || (inputBuild_Configs = new Set())).add(build_config);
				(promises || (promises = [])).push(this.addSourceFileToBuild(file, build_config, true));
			}
		}
		if (dependentBuild_Configs !== null) {
			for (const build_config of dependentBuild_Configs) {
				if (inputBuild_Configs?.has(build_config)) continue;
				(promises || (promises = [])).push(this.addSourceFileToBuild(file, build_config, false));
			}
		}
		if (promises !== null) await Promise.all(promises);
	}

	updatingSourceFiles: Map<string, Promise<boolean>> = new Map();

	// Returns a boolean indicating if the source file should be built.
	// The source file may have been updated or created from a cold cache.
	// It batches calls together, but unlike `buildSourceFile`, it don't queue them,
	// and instead just returns the pending promise.
	private async updateSourceFile(id: string, filerDir: FilerDir): Promise<boolean> {
		const updating = this.updatingSourceFiles.get(id);
		if (updating !== undefined) return updating;
		const promise = wrap(async (after) => {
			after(() => this.updatingSourceFiles.delete(id));

			// this.log.trace(`updating source file ${gray(id)}`);
			const sourceFile = this.files.get(id);
			if (sourceFile !== undefined) {
				assertSourceFile(sourceFile);
				if (sourceFile.filerDir !== filerDir) {
					// This can happen when watchers overlap, a file picked up by two `FilerDir`s.
					// We might be able to support this,
					// but more thought needs to be given to the exact desired behavior.
					// See `validateDirs` for more.
					throw Error(
						'Source file filerDir unexpectedly changed: ' +
							`${gray(sourceFile.id)} changed from ${sourceFile.filerDir.dir} to ${filerDir.dir}`,
					);
				}
			}

			const external =
				sourceFile === undefined
					? isExternalBrowserModule(id)
					: sourceFile.id === EXTERNALS_SOURCE_ID;

			let extension: string;
			let encoding: Encoding;
			if (sourceFile !== undefined) {
				extension = sourceFile.extension;
				encoding = sourceFile.encoding;
			} else if (external) {
				extension = JS_EXTENSION;
				encoding = 'utf8';
			} else {
				extension = extname(id);
				encoding = inferEncoding(extension);
			}
			const newSourceContents = external
				? // TODO doesn't seem we can make this a key derived from the specifiers,
				  // because they're potentially different each build
				  ''
				: await loadContents(this.fs, encoding, id);

			if (sourceFile === undefined) {
				// Memory cache is cold.
				const newSourceFile = await createSourceFile(
					id,
					encoding,
					extension,
					newSourceContents,
					filerDir,
					this.source_metaById.get(id),
					this,
				);
				this.files.set(id, newSourceFile);
				// If the created source file has its build files hydrated from the cache,
				// we assume it doesn't need to be built.
				if (newSourceFile.buildable && newSourceFile.buildFiles.size !== 0) {
					return false;
				}
			} else if (areContentsEqual(encoding, sourceFile.contents, newSourceContents)) {
				// Memory cache is warm and source code hasn't changed, do nothing and exit early!
				return false;
			} else {
				// Memory cache is warm, but contents have changed.
				switch (sourceFile.encoding) {
					case 'utf8':
						sourceFile.contents = newSourceContents as string;
						sourceFile.stats = undefined;
						sourceFile.contentsBuffer = undefined;
						sourceFile.contentsHash = undefined;
						break;
					case null:
						sourceFile.contents = newSourceContents as Buffer;
						sourceFile.stats = undefined;
						sourceFile.contentsBuffer = newSourceContents as Buffer;
						sourceFile.contentsHash = undefined;
						break;
					default:
						throw new Unreachable_Error(sourceFile);
				}
			}
			return filerDir.buildable;
		});
		this.updatingSourceFiles.set(id, promise);
		return promise;
	}

	// These are used to avoid concurrent builds for any given source file.
	// TODO maybe make these `Map<Build_Config, Set<BuildableSourceFile>>`, initialize during `init` to avoid bookkeeping API overhead or speciality code
	private pendingBuilds: Map<Build_Config, Set<string>> = new Map(); // value is source_id
	private enqueuedBuilds: Map<Build_Config, Set<string>> = new Map(); // value is source_id

	// This wrapper function protects against race conditions
	// that could occur with concurrent builds.
	// If a file is currently being build, it enqueues the file id,
	// and when the current build finishes,
	// it removes the item from the queue and rebuilds the file.
	// The queue stores at most one build per file,
	// and this is safe given that building accepts no parameters.
	private async buildSourceFile(
		sourceFile: BuildableSourceFile,
		build_config: Build_Config,
	): Promise<void> {
		let pendingBuilds = this.pendingBuilds.get(build_config);
		if (pendingBuilds === undefined) {
			pendingBuilds = new Set();
			this.pendingBuilds.set(build_config, pendingBuilds);
		}
		let enqueuedBuilds = this.enqueuedBuilds.get(build_config);
		if (enqueuedBuilds === undefined) {
			enqueuedBuilds = new Set();
			this.enqueuedBuilds.set(build_config, enqueuedBuilds);
		}

		const {id} = sourceFile;
		if (pendingBuilds.has(id)) {
			enqueuedBuilds.add(id);
			return;
		}
		pendingBuilds.add(id);
		try {
			await this._buildSourceFile(sourceFile, build_config);
			this.emit('build', {sourceFile, build_config});
		} catch (err) {
			this.log.error(
				print_build_config_label(build_config),
				red('build failed'),
				gray(id),
				print_error(err),
			);
			// TODO probably want to track this failure data
		}
		pendingBuilds.delete(id);
		if (enqueuedBuilds.has(id)) {
			enqueuedBuilds.delete(id);
			// Something changed during the build for this file, so recurse.
			// This sequencing ensures that any awaiting callers always see the final version.
			// TODO do we need to detect cycles? if we run into any, probably
			// TODO this is wasteful - we could get the previous source file's contents by adding a var above,
			// but `updateSourceFile` loads the contents from disk -
			// however I'd rather optimize this only after tests are in place.
			const shouldBuild = await this.updateSourceFile(id, sourceFile.filerDir);
			if (shouldBuild) {
				await this.buildSourceFile(sourceFile, build_config);
			}
		}
	}

	private async _buildSourceFile(
		sourceFile: BuildableSourceFile,
		build_config: Build_Config,
	): Promise<void> {
		this.log.info(
			`${print_build_config_label(build_config)} build source file`,
			gray(sourceFile.id),
		);

		// Compile the source file.
		let result: BuildResult<Build>;

		this.buildingSourceFiles.add(sourceFile.id); // track so we can see what the filer is doing
		try {
			result = await this.builder!.build(sourceFile, build_config, this);
		} catch (err) {
			this.buildingSourceFiles.delete(sourceFile.id);
			throw err;
		}
		this.buildingSourceFiles.delete(sourceFile.id);

		const newBuildFiles: BuildFile[] = result.builds.map((build) =>
			createBuildFile(build, this, result, sourceFile, build_config),
		);

		// Update the source file with the new build files.
		await this.updateBuildFiles(sourceFile, newBuildFiles, build_config);
		await updateSourceMeta(this, sourceFile);
	}

	// Updates the build files in the memory cache and writes to disk.
	private async updateBuildFiles(
		sourceFile: BuildableSourceFile,
		newBuildFiles: BuildFile[],
		build_config: Build_Config,
	): Promise<void> {
		const oldBuildFiles = sourceFile.buildFiles.get(build_config) || null;
		const changes = diffBuildFiles(newBuildFiles, oldBuildFiles);
		sourceFile.buildFiles.set(build_config, newBuildFiles);
		syncBuildFilesToMemoryCache(this.files, changes);
		await Promise.all([
			syncBuildFilesToDisk(this.fs, changes, this.log),
			this.updateDependencies(sourceFile, newBuildFiles, oldBuildFiles, build_config),
		]);
	}

	// This is like `updateBuildFiles` except
	// it's called for source files when they're being hydrated from the cache.
	// This is because the normal build process ending with `updateBuildFiles`
	// is being short-circuited for efficiency, but parts of that process are still needed.
	private async hydrateSourceFileFromCache(
		sourceFile: BuildableSourceFile,
		build_config: Build_Config,
	): Promise<void> {
		// this.log.trace('hydrate', gray(sourceFile.id));
		const buildFiles = sourceFile.buildFiles.get(build_config);
		if (buildFiles === undefined) {
			throw Error(`Expected to find build files when hydrating from cache.`);
		}
		const changes = diffBuildFiles(buildFiles, null);
		syncBuildFilesToMemoryCache(this.files, changes);
		await this.updateDependencies(sourceFile, buildFiles, null, build_config);
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
		sourceFile: BuildableSourceFile,
		newBuildFiles: readonly BuildFile[],
		oldBuildFiles: readonly BuildFile[] | null,
		build_config: Build_Config,
	): Promise<void> {
		if (newBuildFiles === oldBuildFiles) return;

		const {addedDependencies, removedDependencies} =
			diffDependencies(newBuildFiles, oldBuildFiles) || nulls;

		let promises: Promise<void>[] | null = null;

		// handle added dependencies
		if (addedDependencies !== null) {
			for (const addedDependency of addedDependencies) {
				// `external` will be false for Node imports in non-browser contexts -
				// we create no source file for them
				if (!addedDependency.external && isExternalBrowserModule(addedDependency.build_id))
					continue;
				const addedSourceId = this.map_dependency_to_source_id(addedDependency, this.build_dir);
				// ignore dependencies on self - happens with common externals
				if (addedSourceId === sourceFile.id) continue;
				let addedSourceFile = this.files.get(addedSourceId);
				if (addedSourceFile !== undefined) assertBuildableSourceFile(addedSourceFile);
				// lazily create external source file if needed
				if (addedDependency.external) {
					if (addedSourceFile === undefined) {
						addedSourceFile = await this.createExternalsSourceFile(sourceFile.filerDir);
					}
					this.updateExternalsSourceFile(addedSourceFile, addedDependency, build_config);
				}
				// import might point to a nonexistent file, ignore those
				if (addedSourceFile !== undefined) {
					// update `dependents` of the added file
					addDependent(sourceFile, addedSourceFile, build_config, addedDependency);

					// Add source file to build if needed.
					// Externals are handled separately by `updateExternalsSourceFile`, not here,
					// because they're batched for the entire build.
					// If we waited for externals to build before moving on like the normal process,
					// then that could cause cascading externals builds as the dependency tree builds.
					if (!addedSourceFile.build_configs.has(build_config) && !addedDependency.external) {
						(promises || (promises = [])).push(
							this.addSourceFileToBuild(
								addedSourceFile as BuildableSourceFile,
								build_config,
								is_input_to_build_config(addedSourceFile.id, build_config.input),
							),
						);
					}
				}

				// update `dependencies` of the source file
				addDependency(sourceFile, addedSourceId, build_config, addedDependency);
			}
		}
		if (removedDependencies !== null) {
			for (const removedDependency of removedDependencies) {
				const removedSourceId = this.map_dependency_to_source_id(removedDependency, this.build_dir);
				// ignore dependencies on self - happens with common externals
				if (removedSourceId === sourceFile.id) continue;
				const removedSourceFile = this.files.get(removedSourceId);
				// import might point to a nonexistent file, ignore them completely
				if (removedSourceFile === undefined) continue;
				assertBuildableSourceFile(removedSourceFile);
				if (!removedSourceFile.build_configs.has(build_config)) {
					throw Error(`Expected build config ${build_config.name}: ${removedSourceFile.id}`);
				}

				// update `dependencies` of the source file
				let dependenciesMap = sourceFile.dependencies.get(build_config);
				if (dependenciesMap === undefined) {
					throw Error(`Expected dependenciesMap: ${sourceFile.id}`);
				}
				let dependencies = dependenciesMap.get(removedSourceId);
				if (dependencies === undefined) {
					throw Error(`Expected dependencies: ${removedSourceId}: ${sourceFile.id}`);
				}
				dependencies.delete(removedDependency.build_id);
				if (dependencies.size === 0) {
					dependenciesMap.delete(removedSourceId);
				}

				// update `dependents` of the removed file
				let dependentsMap = removedSourceFile.dependents.get(build_config);
				if (dependentsMap === undefined) {
					throw Error(`Expected dependentsMap: ${removedSourceFile.id}`);
				}
				let dependents = dependentsMap.get(sourceFile.id);
				if (dependents === undefined) {
					throw Error(`Expected dependents: ${removedSourceFile.id}: ${sourceFile.id}`);
				}
				dependents.delete(removedDependency.build_id);
				if (dependents.size === 0) {
					dependentsMap.delete(sourceFile.id);
					if (
						dependentsMap.size === 0 &&
						!removedSourceFile.is_input_to_build_configs?.has(build_config) &&
						!removedDependency.external // TODO ignoring these for now, would be weird to remove only when it has none, but not handle other removals (maybe it should handle them?)
					) {
						(promises || (promises = [])).push(
							this.removeSourceFileFromBuild(removedSourceFile, build_config),
						);
					}
				}
			}
		}
		if (promises !== null) await Promise.all(promises); // TODO parallelize with syncing to disk below (in `updateBuildFiles()`)?
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		assertSourceFile(sourceFile);
		this.log.trace('destroying file', gray(id));
		this.files.delete(id);
		if (sourceFile.buildable) {
			if (this.build_configs !== null) {
				await Promise.all(
					this.build_configs.map((b) =>
						sourceFile.build_configs.has(b)
							? this.removeSourceFileFromBuild(sourceFile, b, false)
							: null,
					),
				);
			}
			// passing `false` above to avoid writing `source_meta` to disk for each build -
			// batch delete it now:
			await deleteSourceMeta(this, sourceFile.id);
		}
	}

	// TODO can we remove `createExternalsSourceFile`, treating externals like all others?
	// It seems not, because the `Filer` currently does not handle multiple source files
	// per build, it's 1:N not M:N, and further the externals build lazily,
	// so we probably need to refactor, ultimately into a plugin system.
	private creatingExternalsSourceFile: Promise<BuildableSourceFile> | undefined;
	private async createExternalsSourceFile(filerDir: FilerDir): Promise<BuildableSourceFile> {
		return (
			this.creatingExternalsSourceFile ||
			(this.creatingExternalsSourceFile = (async () => {
				const id = EXTERNALS_SOURCE_ID;
				// this.log.trace('creating external source file', gray(id));
				if (this.files.has(id)) throw Error(`Expected to create source file: ${id}`);
				await this.updateSourceFile(id, filerDir);
				const sourceFile = this.files.get(id);
				assertBuildableSourceFile(sourceFile);
				// TODO why is this needed for the client to work in the browser?
				// shouldn't it be taken care of through the normal externals update?
				// it's duplicating the work of `addSourceFileToBuild`
				if (sourceFile.buildFiles.size > 0) {
					await Promise.all(
						Array.from(sourceFile.buildFiles.keys()).map(
							(build_config) => (
								// TODO this is weird because we're hydrating but not building.
								// and we're not adding to the build either - see comments above for more
								sourceFile.build_configs.add(build_config),
								this.hydrateSourceFileFromCache(sourceFile, build_config)
							),
						),
					);
				}
				return sourceFile;
			})())
		);
	}

	// TODO try to refactor this, maybe merge into `updateSourceFile`?
	// TODO basically..what we want, is when a file is finished building,
	// we want some callback logic to run - the logic is like,
	// "if there are no other pending builds other than this one, proceed with the externals build"
	// the problem is the builds are recursively depth-first!
	// so we can't wait til it's "idle", because it's never idle until everything is built.
	private updateExternalsSourceFile(
		sourceFile: BuildableSourceFile,
		addedDependency: BuildDependency,
		build_config: Build_Config,
	): Promise<void> | null {
		const {specifier} = addedDependency;
		if (specifier.startsWith(EXTERNALS_BUILD_DIR_ROOT_PREFIX)) return null;
		const buildState = getExternalsBuildState(getExternalsBuilderState(this.state), build_config);
		if (!buildState.specifiers.has(specifier)) {
			buildState.specifiers.add(specifier);
			const updating = queueExternalsBuild(
				sourceFile.id,
				buildState,
				this.buildingSourceFiles,
				this.log,
				async () => {
					if (sourceFile.build_configs.has(build_config)) {
						await this.buildSourceFile(sourceFile, build_config);
					} else {
						sourceFile.dirty = true; // force it to build
						await this.addSourceFileToBuild(sourceFile, build_config, false);
					}
				},
			);
			this.updatingExternals.push(updating);
			return updating;
		}
		return null;
	}
	// TODO this could possibly be changed to explicitly call the build,
	// instead of waiting with timeouts in places,
	// and it'd be specific to one ExternalsBuildState, so it'd be per build config.
	// we could then remove things like the tracking what's building in the Filer and externalsBuidler
	private updatingExternals: Promise<void>[] = [];
	private async waitForExternals(): Promise<void> {
		if (!this.updatingExternals.length) return;
		await Promise.all(this.updatingExternals);
		this.updatingExternals.length = 0;
	}
}

const syncBuildFilesToDisk = async (
	fs: Filesystem,
	changes: BuildFileChange[],
	log: Logger,
): Promise<void> => {
	const build_config = changes[0]?.file?.build_config;
	const label = build_config ? print_build_config_label(build_config) : '';
	await Promise.all(
		changes.map(async (change) => {
			const {file} = change;
			let shouldOutputNewFile = false;
			if (change.type === 'added') {
				if (!(await fs.exists(file.id))) {
					// log.trace(label, 'creating build file on disk', gray(file.id));
					shouldOutputNewFile = true;
				} else {
					const existingContents = await loadContents(fs, file.encoding, file.id);
					if (!areContentsEqual(file.encoding, file.contents, existingContents)) {
						log.trace(label, 'updating stale build file on disk', gray(file.id));
						shouldOutputNewFile = true;
					} // ...else the build file on disk already matches what's in memory.
					// This can happen if the source file changed but this particular build file did not.
					// Loading the usually-stale contents into memory to check before writing is inefficient,
					// but it avoids unnecessary writing to disk and misleadingly updated file stats.
				}
			} else if (change.type === 'updated') {
				if (!areContentsEqual(file.encoding, file.contents, change.oldFile.contents)) {
					log.trace(label, 'updating build file on disk', gray(file.id));
					shouldOutputNewFile = true;
				}
			} else if (change.type === 'removed') {
				log.trace(label, 'deleting build file on disk', gray(file.id));
				return fs.remove(file.id);
			} else {
				throw new Unreachable_Error(change);
			}
			if (shouldOutputNewFile) {
				await fs.writeFile(file.id, file.contents);
			}
		}),
	);
};

const syncBuildFilesToMemoryCache = (
	files: Map<string, FilerFile>,
	changes: BuildFileChange[],
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
type BuildFileChange =
	| {
			type: 'added';
			file: BuildFile;
	  }
	| {
			type: 'updated';
			file: BuildFile;
			oldFile: BuildFile;
	  }
	| {
			type: 'removed';
			file: BuildFile;
	  };

// Given `newFiles` and `oldFiles`, returns a description of changes.
// This uses `Array#find` because the arrays are expected to be small,
// because we're currently only using it for individual file builds,
// but that assumption might change and cause this code to be slow.
// TODO maybe change to sets or a better data structure for the usage patterns?
const diffBuildFiles = (
	newFiles: readonly BuildFile[],
	oldFiles: readonly BuildFile[] | null,
): BuildFileChange[] => {
	let changes: BuildFileChange[];
	if (oldFiles === null) {
		changes = newFiles.map((file) => ({type: 'added', file}));
	} else {
		changes = [];
		for (const oldFile of oldFiles) {
			const newFile = newFiles.find((f) => f.id === oldFile.id);
			if (newFile !== undefined) {
				changes.push({type: 'updated', oldFile, file: newFile});
			} else {
				changes.push({type: 'removed', file: oldFile});
			}
		}
		for (const newFile of newFiles) {
			if (!oldFiles.some((f) => f.id === newFile.id)) {
				changes.push({type: 'added', file: newFile});
			}
		}
	}
	return changes;
};

const areContentsEqual = (encoding: Encoding, a: string | Buffer, b: string | Buffer): boolean => {
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
// Some of these conditions like nested sourceDirs could be fixed
// but there are inefficiencies and possibly some subtle bugs.
const validateDirs = (sourceDirs: string[]) => {
	for (const sourceDir of sourceDirs) {
		const nestedSourceDir = sourceDirs.find((d) => d !== sourceDir && sourceDir.startsWith(d));
		if (nestedSourceDir) {
			throw Error(
				'A sourceDir cannot be inside another sourceDir: ' +
					`${sourceDir} is inside ${nestedSourceDir}`,
			);
		}
	}
};

// Creates objects to load a directory's contents and sync filesystem changes in memory.
// The order of objects in the returned array is meaningless.
const createFilerDirs = (
	fs: Filesystem,
	sourceDirs: string[],
	served_dirs: ServedDir[],
	build_dir: string,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	watcherDebounce: number | undefined,
	filter: PathFilter | undefined,
): FilerDir[] => {
	const dirs: FilerDir[] = [];
	for (const sourceDir of sourceDirs) {
		dirs.push(createFilerDir(fs, sourceDir, true, onChange, watch, watcherDebounce, filter));
	}
	for (const served_dir of served_dirs) {
		// If a `served_dir` is inside a source or externals directory,
		// it's already in the Filer's memory cache and does not need to be loaded as a directory.
		// Additionally, the same is true for `served_dir`s that are inside other `served_dir`s.
		if (
			// TODO I think these are bugged with trailing slashes -
			// note the `served_dir.dir` of `served_dir.dir.startsWith` could also not have a trailing slash!
			// so I think you add `{dir} + '/'` to both?
			!sourceDirs.find((d) => served_dir.path.startsWith(d)) &&
			!served_dirs.find((d) => d !== served_dir && served_dir.path.startsWith(d.path)) &&
			!served_dir.path.startsWith(build_dir)
		) {
			dirs.push(
				createFilerDir(fs, served_dir.path, false, onChange, watch, watcherDebounce, filter),
			);
		}
	}
	return dirs;
};

const addDependent = (
	dependentSourceFile: BuildableSourceFile,
	dependencySourceFile: BuildableSourceFile,
	build_config: Build_Config,
	addedDependency: BuildDependency,
) => {
	let dependentsMap = dependencySourceFile.dependents.get(build_config);
	if (dependentsMap === undefined) {
		dependencySourceFile.dependents.set(build_config, (dependentsMap = new Map()));
	}
	let dependents = dependentsMap.get(dependentSourceFile.id);
	if (dependents === undefined) {
		dependentsMap.set(dependentSourceFile.id, (dependents = new Map()));
	}
	dependents.set(addedDependency.build_id, addedDependency);
};

const addDependency = (
	dependentSourceFile: BuildableSourceFile,
	dependencySourceId: string,
	build_config: Build_Config,
	addedDependency: BuildDependency,
) => {
	let dependenciesMap = dependentSourceFile.dependencies.get(build_config);
	if (dependenciesMap === undefined) {
		dependentSourceFile.dependencies.set(build_config, (dependenciesMap = new Map()));
	}
	let dependencies = dependenciesMap.get(dependencySourceId);
	if (dependencies === undefined) {
		dependenciesMap.set(dependencySourceId, (dependencies = new Map()));
	}
	dependencies.set(addedDependency.build_id, addedDependency);
};
