import {resolve, extname, join} from 'path';
import * as lexer from 'es-module-lexer';
import {EventEmitter} from 'events';
import type StrictEventEmitter from 'strict-event-emitter-types';
import {nulls, omitUndefined} from '@feltjs/util/object.js';
import {UnreachableError} from '@feltjs/util/error.js';
import {printLogLabel, SystemLogger, type Logger} from '@feltjs/util/log.js';
import {gray, red, cyan} from 'kleur/colors';
import {printError} from '@feltjs/util/print.js';
import type {Assignable, PartialExcept} from '@feltjs/util/types.js';

import type {Filesystem} from '../fs/filesystem.js';
import {createFilerDir, type FilerDir, type FilerDirChangeCallback} from '../build/filerDir.js';
import {
	isInputToBuildConfig,
	mapDependencyToSourceId,
	type MapDependencyToSourceId,
} from './utils.js';
import {paths as defaultPaths, toBuildOutPath, type Paths} from '../paths.js';
import type {BuildContext, Builder} from './builder.js';
import {inferEncoding, type Encoding} from '../fs/encoding.js';
import {printBuildConfigLabel} from '../build/buildConfig.js';
import type {BuildName, BuildConfig} from './buildConfig.js';
import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/buildConfigDefaults.js';
import type {EcmaScriptTarget} from './typescriptUtils.js';
import {assertSourceFile, createSourceFile, type SourceFile} from './sourceFile.js';
import {diffDependencies, type BuildFile} from './buildFile.js';
import type {BaseFilerFile} from './filerFile.js';
import {loadContent} from './load.js';
import {
	type SourceMeta,
	deleteSourceMeta,
	updateSourceMeta,
	cleanSourceMeta,
	initSourceMeta,
} from './sourceMeta.js';
import type {BuildDependency} from './buildDependency.js';
import type {PathFilter} from '../fs/filter.js';
import {isExternalModule} from '../utils/module.js';
import {throttleAsync} from '../utils/throttleAsync.js';

/*

The `Filer` is at the heart of the build system.

The `Filer` wholly owns its `buildDir`, `./.gro` by default.
If any files or directories change inside it without going through the `Filer`,
it may go into a corrupted state.
Corrupted states can be fixed by turning off the `Filer` and running `gro clean`.

TODO

- add tests (fully modularize as they're added, running tests for host interfaces both in memory and on the filesystem)
- probably silence a lot of the logging (or add `debug` log level?) once tests are added

*/

// The Filer is an `EventEmitter` with the following events:
type FilerEmitter = StrictEventEmitter<EventEmitter, FilerEvents>;
export interface FilerEvents {
	build: {sourceFile: SourceFile; buildConfig: BuildConfig};
}

export type FilerFile = SourceFile | BuildFile; // TODO or `Directory`?

export interface Options {
	fs: Filesystem;
	paths: Paths;
	dev: boolean;
	builder: Builder;
	buildConfigs: BuildConfig[];
	buildDir: string;
	sourceDirs: string[];
	mapDependencyToSourceId: MapDependencyToSourceId;
	sourcemap: boolean;
	types: boolean;
	target: EcmaScriptTarget;
	watch: boolean;
	watcherDebounce: number | undefined;
	filter: PathFilter | undefined;
	cleanOutputDirs: boolean;
	log: Logger;
}
export type RequiredOptions = 'fs' | 'builder' | 'buildConfigs' | 'sourceDirs';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	const paths = opts.paths ?? defaultPaths;
	const dev = opts.dev ?? true;
	if (opts.buildConfigs.length === 0) {
		throw Error(
			'Filer created with an empty array of buildConfigs.' +
				' Omit the value or provide `null` if this was intended.',
		);
	}
	const buildDir = opts.buildDir || paths.build; // TODO assumes trailing slash
	const sourceDirs = validateDirs(opts.sourceDirs);
	return {
		mapDependencyToSourceId,
		sourcemap: true,
		types: !dev,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		watch: true,
		watcherDebounce: undefined,
		filter: undefined,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		paths,
		dev,
		log: opts.log || new SystemLogger(printLogLabel('filer')),
		buildDir,
		sourceDirs,
	};
};

export class Filer extends (EventEmitter as {new (): FilerEmitter}) implements BuildContext {
	// TODO think about accessors - I'm currently just making things public when I need them here
	private readonly files: Map<string, FilerFile> = new Map();
	private readonly dirs: FilerDir[];
	private readonly builder: Builder;
	private readonly mapDependencyToSourceId: MapDependencyToSourceId;

	// These public `BuildContext` properties are available to e.g. builders, helpers, postprocessors.
	// This pattern lets us pass around `this` filer
	// without constantly destructuring and handling long argument lists.
	readonly fs: Filesystem; // TODO I don't like the idea of the filer being associated with a single fs host like this - parameterize instead of putting it on `BuildContext`, probably
	readonly paths: Paths;
	readonly buildConfigs: readonly BuildConfig[];
	readonly buildNames: Set<BuildName>;
	readonly sourceMetaById: Map<string, SourceMeta> = new Map();
	readonly log: Logger;
	readonly buildDir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget; // TODO shouldn't build configs have this?
	readonly buildingSourceFiles: Set<string> = new Set(); // needed by hacky externals code, used to check if the filer is busy
	// TODO not sure about this
	readonly findById = (id: string): BaseFilerFile | undefined => this.files.get(id);

	constructor(opts: InitialOptions) {
		super();
		const {
			fs,
			paths,
			dev,
			builder,
			buildConfigs,
			buildDir,
			sourceDirs,
			mapDependencyToSourceId,
			sourcemap,
			target,
			watch,
			watcherDebounce,
			filter,
			log,
		} = initOptions(opts);
		this.fs = fs;
		this.paths = paths;
		this.dev = dev;
		this.builder = builder;
		this.buildConfigs = buildConfigs;
		this.buildNames = new Set(buildConfigs.map((b) => b.name));
		this.buildDir = buildDir;
		this.mapDependencyToSourceId = mapDependencyToSourceId;
		this.sourcemap = sourcemap;
		this.target = target;
		this.log = log;
		// Creates objects to load a directory's content and sync filesystem changes in memory.
		// The order of objects in the returned array is meaningless.
		this.dirs = sourceDirs.map((sourceDir) =>
			createFilerDir(fs, sourceDir, this.onDirChange, watch, watcherDebounce, filter),
		);
		log.debugcyan('buildConfigs'), buildConfigs);
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

		this.log.debug'init', gray(this.dev ? 'development' : 'production'));

		await Promise.all([initSourceMeta(this), lexer.init]);
		// this.log.debug'inited cache');

		// This initializes all files in the filer's directories, loading them into memory,
		// including files to be served, source files, and build files.
		// Initializing the dirs must be done after `this.initSourceMeta`
		// because it creates source files, which need `this.sourceMetaById` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// this.log.debug'inited files');

		// Now that the source meta and source files are loaded into memory,
		// check if any source files have been deleted since the last run.
		await cleanSourceMeta(this);
		// this.log.debug'cleaned');

		// This initializes the builders. Should be done before the builds are initialized.
		// TODO does this belong in `dir.init`? or parallel with .. what?
		// what data is not yet ready? does this belong inside `initBuilds`?
		if (this.builder.init) {
			await this.builder.init(this);
		}

		// This performs the initial source file build, traces deps,
		// and populates the `buildConfigs` property of all source files.
		await this.initBuilds();
		// this.log.debug'inited builds');
		// this.log.info('buildConfigs', this.buildConfigs);

		// TODO check if `src/` has any conflicting dirs like `src/externals`

		// this.log.debugblue('initialized!'));
	}

	// During initialization, after all files are loaded into memory,
	// this is called to populate the `buildConfigs` property of all source files.
	// It traces the dependencies starting from each `buildConfig.input`,
	// building each input source file and populating its `buildConfigs`,
	// recursively until all dependencies have been handled.
	private async initBuilds(): Promise<void> {
		const promises: Array<Promise<void>> = [];

		const filters: Array<(id: string) => boolean> = [];
		const filterBuildConfigs: BuildConfig[] = [];

		// Iterate through the build config inputs and initialize their files.
		for (const buildConfig of this.buildConfigs) {
			for (const input of buildConfig.input) {
				if (typeof input === 'function') {
					filters.push(input);
					filterBuildConfigs.push(buildConfig);
					continue;
				}
				const file = this.files.get(input);
				// TODO this assert throws with a bad error - should print `input`
				try {
					assertSourceFile(file);
				} catch (_err) {
					this.log.error(printBuildConfigLabel(buildConfig), red('missing input'), input);
					throw Error('Missing input: check the build config and source files for the above input');
				}
				if (!file.buildConfigs.has(buildConfig)) {
					promises.push(this.addSourceFileToBuild(file, buildConfig, true));
				}
			}
		}

		// Iterate through the files once and apply the filters to all source files.
		if (filters.length) {
			for (const file of this.files.values()) {
				if (file.type !== 'source') continue;
				for (let i = 0; i < filters.length; i++) {
					if (filters[i](file.id)) {
						const buildConfig = filterBuildConfigs[i];
						if (!file.buildConfigs.has(buildConfig)) {
							promises.push(this.addSourceFileToBuild(file, buildConfig, true));
						}
					}
				}
			}
		}

		await Promise.all(promises);
	}

	// Adds a build config to a source file.
	// The caller is expected to check to avoid duplicates.
	private async addSourceFileToBuild(
		sourceFile: SourceFile,
		buildConfig: BuildConfig,
		isInput: boolean,
	): Promise<void> {
		// this.log.debug
		// 	`adding source file to build ${printBuildConfigLabel(buildConfig)} ${gray(sourceFile.id)}`,
		// );
		if (sourceFile.buildConfigs.has(buildConfig)) {
			throw Error(`Already has buildConfig ${buildConfig.name}: ${gray(sourceFile.id)}`);
		}
		// Add the build config. The caller is expected to check to avoid duplicates.
		sourceFile.buildConfigs.add(buildConfig);
		// Add the build config as an input if appropriate, initializing the set if needed.
		// We need to determine `isInputToBuildConfig` independently of the caller,
		// because the caller may not
		if (isInput) {
			if (sourceFile.isInputToBuildConfigs === null) {
				// Cast to keep the `readonly` modifier outside of initialization.
				(sourceFile as Assignable<SourceFile, 'isInputToBuildConfigs'>).isInputToBuildConfigs =
					new Set();
			}
			sourceFile.isInputToBuildConfigs!.add(buildConfig);
		}

		// Build only if needed - build files may be hydrated from the cache.
		const hasBuildConfig = sourceFile.buildFiles.has(buildConfig);
		if (hasBuildConfig) {
			await this.hydrateSourceFileFromCache(sourceFile, buildConfig);
		}
		const {dirty} = sourceFile;
		if (!hasBuildConfig || dirty) {
			await this.buildSourceFile(sourceFile, buildConfig);
			if (dirty) sourceFile.dirty = false;
		}
	}

	// Removes a build config from a source file.
	// The caller is expected to check to avoid duplicates.
	private async removeSourceFileFromBuild(
		sourceFile: SourceFile,
		buildConfig: BuildConfig,
		shouldUpdateSourceMeta = true,
	): Promise<void> {
		this.log.debug
			`${printBuildConfigLabel(buildConfig)} removing source file ${gray(sourceFile.id)}`,
		);

		await this.updateBuildFiles(sourceFile, [], buildConfig);

		const deleted = sourceFile.buildConfigs.delete(buildConfig);
		if (!deleted) {
			throw Error(`Expected to delete buildConfig ${buildConfig.name}: ${sourceFile.id}`);
		}
		const deletedBuildFiles = sourceFile.buildFiles.delete(buildConfig);
		if (!deletedBuildFiles) {
			throw Error(`Expected to delete build files ${buildConfig.name}: ${sourceFile.id}`);
		}
		sourceFile.dependencies.delete(buildConfig);
		sourceFile.dependents.delete(buildConfig);
		const {onRemove} = this.builder;
		if (onRemove) {
			try {
				await onRemove(sourceFile, buildConfig, this);
			} catch (err) {
				this.log.error(
					`${printBuildConfigLabel(buildConfig)} error while removing source file from builder`,
					printError(err),
				);
			}
		}

		if (shouldUpdateSourceMeta) {
			await updateSourceMeta(this, sourceFile);
		}
	}

	private onDirChange: FilerDirChangeCallback = async (change, filerDir) => {
		const id = join(filerDir.dir, change.path);
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
						change.type !== 'init'
					) {
						const file = this.files.get(id);
						assertSourceFile(file);
						if (change.type === 'create') {
							await this.initSourceFile(file);
						} else {
							await Promise.all(
								Array.from(file.buildConfigs).map((buildConfig) =>
									this.buildSourceFile(file, buildConfig),
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
					await Promise.all(
						this.buildConfigs.map((buildConfig) =>
							this.fs.remove(
								toBuildOutPath(this.dev, buildConfig.name, change.path, this.buildDir),
							),
						),
					);
				} else {
					await this.destroySourceId(id);
				}
				break;
			}
			default:
				throw new UnreachableError(change.type);
		}
	};

	// Initialize a newly created source file's builds.
	// It currently uses a slow brute force search to find dependents.
	private async initSourceFile(file: SourceFile): Promise<void> {
		let promises: Array<Promise<void>> | null = null;
		let dependentBuildConfigs: Set<BuildConfig> | null = null;
		// TODO could be sped up with some caching data structures
		for (const f of this.files.values()) {
			if (f.type !== 'source') continue;
			for (const [buildConfig, dependenciesMap] of f.dependencies) {
				if (dependenciesMap.has(file.id)) {
					const dependencies = dependenciesMap.get(file.id)!;
					for (const dependency of dependencies.values()) {
						addDependent(f, file, buildConfig, dependency);
					}
					(dependentBuildConfigs || (dependentBuildConfigs = new Set())).add(buildConfig);
				}
			}
		}
		let inputBuildConfigs: Set<BuildConfig> | null = null;
		for (const buildConfig of this.buildConfigs) {
			if (isInputToBuildConfig(file.id, buildConfig.input)) {
				(inputBuildConfigs || (inputBuildConfigs = new Set())).add(buildConfig);
				(promises || (promises = [])).push(this.addSourceFileToBuild(file, buildConfig, true));
			}
		}
		if (dependentBuildConfigs !== null) {
			for (const buildConfig of dependentBuildConfigs) {
				if (inputBuildConfigs?.has(buildConfig)) continue;
				(promises || (promises = [])).push(this.addSourceFileToBuild(file, buildConfig, false));
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
		if (updating) return updating;
		const done = () => this.updatingSourceFiles.delete(id);
		const promise: Promise<boolean> = Promise.resolve()
			.then(async () => {
				// this.log.debug`updating source file ${gray(id)}`);
				const sourceFile = this.files.get(id);
				if (sourceFile) {
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

				let extension: string;
				let encoding: Encoding;
				if (sourceFile) {
					extension = sourceFile.extension;
					encoding = sourceFile.encoding;
				} else {
					extension = extname(id);
					encoding = inferEncoding(extension);
				}
				const newSourceContent = await loadContent(this.fs, encoding, id); // TODO problem with this is loading stuff not part of the build (for serving, could lazy load)

				if (!sourceFile) {
					// Memory cache is cold.
					if (isExternalModule(id)) {
						throw Error('TODO unexpected');
					}
					const newSourceFile = await createSourceFile(
						id,
						encoding,
						extension,
						newSourceContent,
						filerDir,
						this.sourceMetaById.get(id), // TODO should this lazy load the source meta?
						this,
					);
					this.files.set(id, newSourceFile);
					// If the created source file has its build files hydrated from the cache,
					// we assume it doesn't need to be built.
					if (newSourceFile.buildFiles.size !== 0) {
						return false;
					}
				} else if (isContentEqual(encoding, sourceFile.content, newSourceContent)) {
					// Memory cache is warm and source code hasn't changed, do nothing and exit early!
					return false;
				} else {
					// Memory cache is warm, but content have changed.
					switch (sourceFile.encoding) {
						case 'utf8':
							sourceFile.content = newSourceContent as string;
							sourceFile.stats = undefined;
							sourceFile.contentBuffer = undefined;
							sourceFile.contentHash = undefined;
							break;
						case null:
							sourceFile.content = newSourceContent as Buffer;
							sourceFile.stats = undefined;
							sourceFile.contentBuffer = newSourceContent as Buffer;
							sourceFile.contentHash = undefined;
							break;
						default:
							throw new UnreachableError(sourceFile);
					}
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
		this.updatingSourceFiles.set(id, promise);
		return promise;
	}

	private buildSourceFile = throttleAsync(
		async (sourceFile: SourceFile, buildConfig: BuildConfig): Promise<void> => {
			try {
				await this._buildSourceFile(sourceFile, buildConfig);
				this.emit('build', {sourceFile, buildConfig});
			} catch (err) {
				// TODO probably want to track this failure data
				this.log.error(
					printBuildConfigLabel(buildConfig),
					red('build failed'),
					gray(sourceFile.id),
					printError(err),
				);
			}
		},
		(sourceFile, buildConfig) => buildConfig.name + '::' + sourceFile.id,
	);

	private async _buildSourceFile(sourceFile: SourceFile, buildConfig: BuildConfig): Promise<void> {
		this.log.debug`${printBuildConfigLabel(buildConfig)} build source file`, gray(sourceFile.id));

		// Compile the source file.
		let buildFiles: BuildFile[];

		this.buildingSourceFiles.add(sourceFile.id); // track so we can see what the filer is doing
		try {
			buildFiles = await this.builder.build(sourceFile, buildConfig, this);
		} catch (err) {
			this.buildingSourceFiles.delete(sourceFile.id);
			throw err;
		}
		this.buildingSourceFiles.delete(sourceFile.id);

		// Update the source file with the new build files.
		await this.updateBuildFiles(sourceFile, buildFiles, buildConfig);
		await updateSourceMeta(this, sourceFile);
	}

	// Updates the build files in the memory cache and writes to disk.
	private async updateBuildFiles(
		sourceFile: SourceFile,
		newBuildFiles: BuildFile[],
		buildConfig: BuildConfig,
	): Promise<void> {
		const oldBuildFiles = sourceFile.buildFiles.get(buildConfig) || null;
		const changes = diffBuildFiles(newBuildFiles, oldBuildFiles);
		sourceFile.buildFiles.set(buildConfig, newBuildFiles);
		syncBuildFilesToMemoryCache(this.files, changes);
		await Promise.all([
			syncBuildFilesToDisk(this.fs, changes, this.log),
			this.updateDependencies(sourceFile, newBuildFiles, oldBuildFiles, buildConfig),
		]);
	}

	// This is like `updateBuildFiles` except
	// it's called for source files when they're being hydrated from the cache.
	// This is because the normal build process ending with `updateBuildFiles`
	// is being short-circuited for efficiency, but parts of that process are still needed.
	private async hydrateSourceFileFromCache(
		sourceFile: SourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		// this.log.debug'hydrate', gray(sourceFile.id));
		const buildFiles = sourceFile.buildFiles.get(buildConfig);
		if (buildFiles === undefined) {
			throw Error(`Expected to find build files when hydrating from cache.`);
		}
		const changes = diffBuildFiles(buildFiles, null);
		syncBuildFilesToMemoryCache(this.files, changes);
		await this.updateDependencies(sourceFile, buildFiles, null, buildConfig);
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
		sourceFile: SourceFile,
		newBuildFiles: readonly BuildFile[],
		oldBuildFiles: readonly BuildFile[] | null,
		buildConfig: BuildConfig,
	): Promise<void> {
		if (newBuildFiles === oldBuildFiles) return;

		const {addedDependencies, removedDependencies} =
			diffDependencies(newBuildFiles, oldBuildFiles) || nulls;

		let promises: Array<Promise<void>> | null = null;

		// handle added dependencies
		if (addedDependencies !== null) {
			for (const addedDependency of addedDependencies) {
				// we create no source file for externals
				if (addedDependency.external) continue;
				// eslint-disable-next-line no-await-in-loop
				const addedSourceId = await this.mapDependencyToSourceId(
					addedDependency,
					this.buildDir,
					this.fs,
					this.paths,
				);
				// ignore dependencies on self - happens with common externals
				if (addedSourceId === sourceFile.id) continue;
				const addedSourceFile = this.files.get(addedSourceId);
				if (addedSourceFile !== undefined) assertSourceFile(addedSourceFile);
				// import might point to a nonexistent file, ignore those
				if (addedSourceFile !== undefined) {
					// update `dependents` of the added file
					addDependent(sourceFile, addedSourceFile, buildConfig, addedDependency);

					// Add source file to build if needed.
					// Externals are handled separately by `updateExternalsSourceFile`, not here,
					// because they're batched for the entire build.
					// If we waited for externals to build before moving on like the normal process,
					// then that could cause cascading externals builds as the dependency tree builds.
					if (!addedSourceFile.buildConfigs.has(buildConfig)) {
						(promises || (promises = [])).push(
							this.addSourceFileToBuild(
								addedSourceFile as SourceFile,
								buildConfig,
								isInputToBuildConfig(addedSourceFile.id, buildConfig.input),
							),
						);
					}
				}

				// update `dependencies` of the source file
				addDependency(sourceFile, addedSourceId, buildConfig, addedDependency);
			}
		}
		if (removedDependencies !== null) {
			for (const removedDependency of removedDependencies) {
				// eslint-disable-next-line no-await-in-loop
				const removedSourceId = await this.mapDependencyToSourceId(
					removedDependency,
					this.buildDir,
					this.fs,
					this.paths,
				);
				// ignore dependencies on self - happens with common externals
				if (removedSourceId === sourceFile.id) continue;
				const removedSourceFile = this.files.get(removedSourceId);
				// import might point to a nonexistent file, ignore them completely
				if (removedSourceFile === undefined) continue;
				assertSourceFile(removedSourceFile);
				if (!removedSourceFile.buildConfigs.has(buildConfig)) {
					throw Error(`Expected build config ${buildConfig.name}: ${removedSourceFile.id}`);
				}

				// update `dependencies` of the source file
				const dependenciesMap = sourceFile.dependencies.get(buildConfig);
				if (dependenciesMap === undefined) {
					throw Error(`Expected dependenciesMap: ${sourceFile.id}`);
				}
				const dependencies = dependenciesMap.get(removedSourceId);
				if (dependencies === undefined) {
					throw Error(`Expected dependencies: ${removedSourceId}: ${sourceFile.id}`);
				}
				dependencies.delete(removedDependency.buildId);
				if (dependencies.size === 0) {
					dependenciesMap.delete(removedSourceId);
				}

				// update `dependents` of the removed file
				const dependentsMap = removedSourceFile.dependents.get(buildConfig);
				if (dependentsMap === undefined) {
					throw Error(`Expected dependentsMap: ${removedSourceFile.id}`);
				}
				const dependents = dependentsMap.get(sourceFile.id);
				if (dependents === undefined) {
					throw Error(`Expected dependents: ${removedSourceFile.id}: ${sourceFile.id}`);
				}
				dependents.delete(removedDependency.buildId);
				if (dependents.size === 0) {
					dependentsMap.delete(sourceFile.id);
					if (
						dependentsMap.size === 0 &&
						!removedSourceFile.isInputToBuildConfigs?.has(buildConfig)
					) {
						(promises || (promises = [])).push(
							this.removeSourceFileFromBuild(removedSourceFile, buildConfig),
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
		this.log.debug'destroying file', gray(id));
		this.files.delete(id);
		await Promise.all(
			this.buildConfigs.map((b) =>
				sourceFile.buildConfigs.has(b)
					? this.removeSourceFileFromBuild(sourceFile, b, false)
					: null,
			),
		);
		// TODO instead of batching like this here, make that concern internal to the sourceMeta
		// passing `false` above to avoid writing `sourceMeta` to disk for each build -
		// batch delete it now:
		await deleteSourceMeta(this, sourceFile.id);
	}
}

const syncBuildFilesToDisk = async (
	fs: Filesystem,
	changes: BuildFileChange[],
	log: Logger,
): Promise<void> => {
	const buildConfig = changes[0]?.file?.buildConfig;
	const label = buildConfig ? printBuildConfigLabel(buildConfig) : '';
	await Promise.all(
		changes.map(async (change) => {
			const {file} = change;
			let shouldOutputNewFile = false;
			if (change.type === 'added') {
				if (!(await fs.exists(file.id))) {
					// log.debuglabel, 'creating build file on disk', gray(file.id));
					shouldOutputNewFile = true;
				} else {
					const existingContent = await loadContent(fs, file.encoding, file.id);
					if (!isContentEqual(file.encoding, file.content, existingContent)) {
						log.debuglabel, 'updating stale build file on disk', gray(file.id));
						shouldOutputNewFile = true;
					} // ...else the build file on disk already matches what's in memory.
					// This can happen if the source file changed but this particular build file did not.
					// Loading the usually-stale content into memory to check before writing is inefficient,
					// but it avoids unnecessary writing to disk and misleadingly updated file stats.
				}
			} else if (change.type === 'updated') {
				if (!isContentEqual(file.encoding, file.content, change.oldFile.content)) {
					log.debuglabel, 'updating build file on disk', gray(file.id));
					shouldOutputNewFile = true;
				}
			} else if (change.type === 'removed') {
				log.debuglabel, 'deleting build file on disk', gray(file.id));
				return fs.remove(file.id);
			} else {
				throw new UnreachableError(change);
			}
			if (shouldOutputNewFile) {
				await fs.writeFile(file.id, file.content);
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

const isContentEqual = (encoding: Encoding, a: string | Buffer, b: string | Buffer): boolean => {
	switch (encoding) {
		case 'utf8':
			return a === b;
		case null:
			return (a as Buffer).equals(b as Buffer);
		default:
			throw new UnreachableError(encoding);
	}
};

// TODO Revisit these restrictions - the goal right now is to set limits
// to avoid undefined behavior at the cost of flexibility.
// Some of these conditions like nested sourceDirs could be fixed
// but there are inefficiencies and possibly some subtle bugs.
const validateDirs = (sourceDirs: string[]): string[] => {
	if (!sourceDirs.length) throw Error('No source dirs provided');
	const dirs = sourceDirs.map((d) => resolve(d));
	for (const sourceDir of dirs) {
		const nestedSourceDir = dirs.find((d) => d !== sourceDir && sourceDir.startsWith(d));
		if (nestedSourceDir) {
			throw Error(
				'A sourceDir cannot be inside another sourceDir: ' +
					`${sourceDir} is inside ${nestedSourceDir}`,
			);
		}
	}
	return dirs;
};

const addDependent = (
	dependentSourceFile: SourceFile,
	dependencySourceFile: SourceFile,
	buildConfig: BuildConfig,
	addedDependency: BuildDependency,
) => {
	let dependentsMap = dependencySourceFile.dependents.get(buildConfig);
	if (dependentsMap === undefined) {
		dependencySourceFile.dependents.set(buildConfig, (dependentsMap = new Map()));
	}
	let dependents = dependentsMap.get(dependentSourceFile.id);
	if (dependents === undefined) {
		dependentsMap.set(dependentSourceFile.id, (dependents = new Map()));
	}
	dependents.set(addedDependency.buildId, addedDependency);
};

const addDependency = (
	dependentSourceFile: SourceFile,
	dependencySourceId: string,
	buildConfig: BuildConfig,
	addedDependency: BuildDependency,
) => {
	let dependenciesMap = dependentSourceFile.dependencies.get(buildConfig);
	if (dependenciesMap === undefined) {
		dependentSourceFile.dependencies.set(buildConfig, (dependenciesMap = new Map()));
	}
	let dependencies = dependenciesMap.get(dependencySourceId);
	if (dependencies === undefined) {
		dependenciesMap.set(dependencySourceId, (dependencies = new Map()));
	}
	dependencies.set(addedDependency.buildId, addedDependency);
};
