import {resolve, extname, join} from 'path';
import lexer from 'es-module-lexer';

import {FilerDir, FilerDirChangeCallback, createFilerDir} from '../build/FilerDir.js';
import {MapDependencyToSourceId, mapDependencyToSourceId} from './utils.js';
import {remove, outputFile, pathExists} from '../fs/nodeFs.js';
import {EXTERNALS_BUILD_DIR_SUBPATH, JS_EXTENSION, paths, toBuildOutPath} from '../paths.js';
import {nulls, omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {gray, magenta, red, blue} from '../utils/terminal.js';
import {printError} from '../utils/print.js';
import type {
	Build,
	BuildContext,
	BuildDependency,
	Builder,
	BuilderState,
	BuildResult,
} from './builder.js';
import {Encoding, inferEncoding} from '../fs/encoding.js';
import {BuildConfig, printBuildConfig} from '../config/buildConfig.js';
import {EcmaScriptTarget, DEFAULT_ECMA_SCRIPT_TARGET} from './tsBuildHelpers.js';
import {ServedDir, ServedDirPartial, toServedDirs} from './ServedDir.js';
import {
	assertBuildableSourceFile,
	assertSourceFile,
	BuildableSourceFile,
	createSourceFile,
	SourceFile,
} from './sourceFile.js';
import {BuildFile, createBuildFile, diffDependencies} from './buildFile.js';
import type {BaseFilerFile} from './baseFilerFile.js';
import {loadContents} from './load.js';
import {isExternalBrowserModule} from '../utils/module.js';
import {wrap} from '../utils/async.js';
import {
	DEFAULT_EXTERNALS_ALIASES,
	ExternalsAliases,
	EXTERNALS_SOURCE_ID,
	getExternalsBuilderState,
	getExternalsBuildState,
} from './externalsBuildHelpers.js';
import {queueExternalsBuild} from './externalsBuilder.js';
import type {SourceMeta} from './sourceMeta.js';
import {deleteSourceMeta, updateSourceMeta, cleanSourceMeta, initSourceMeta} from './sourceMeta.js';

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

export type FilerFile = SourceFile | BuildFile; // TODO or `Directory`?

export interface Options {
	dev: boolean;
	builder: Builder | null;
	buildConfigs: BuildConfig[] | null;
	buildDir: string;
	sourceDirs: string[];
	servedDirs: ServedDir[];
	externalsAliases: ExternalsAliases;
	mapDependencyToSourceId: MapDependencyToSourceId;
	sourcemap: boolean;
	target: EcmaScriptTarget;
	watch: boolean;
	watcherDebounce: number | undefined;
	cleanOutputDirs: boolean;
	log: Logger;
}
export type InitialOptions = OmitStrict<Partial<Options>, 'servedDirs'> & {
	servedDirs?: ServedDirPartial[];
};
export const initOptions = (opts: InitialOptions): Options => {
	const dev = opts.dev ?? true;
	const buildConfigs = opts.buildConfigs || null;
	if (buildConfigs?.length === 0) {
		throw Error(
			'Filer created with an empty array of buildConfigs.' +
				' Omit the value or provide `null` if this was intended.',
		);
	}
	const buildDir = opts.buildDir || paths.build; // TODO assumes trailing slash
	const sourceDirs = opts.sourceDirs ? opts.sourceDirs.map((d) => resolve(d)) : [];
	validateDirs(sourceDirs);
	const servedDirs = toServedDirs(
		opts.servedDirs ||
			(buildConfigs === null
				? []
				: [
						// default to a best guess
						toBuildOutPath(
							dev,
							(
								buildConfigs.find((c) => c.platform === 'browser' && c.primary) ||
								buildConfigs.find((c) => c.platform === 'browser') ||
								buildConfigs.find((c) => c.primary)!
							).name,
							'',
							buildDir,
						),
				  ]),
	);
	const builder = opts.builder || null;
	if (sourceDirs.length) {
		if (!buildConfigs) {
			throw Error('Filer created with directories to build but no build configs were provided.');
		}
		if (!builder) {
			throw Error('Filer created with directories to build but no builder was provided.');
		}
	} else {
		if (!servedDirs.length) {
			throw Error('Filer created with no directories to build or serve.');
		}
		if (builder) {
			throw Error('Filer created with a builder but no directories to build.');
		}
		if (buildConfigs) {
			throw Error('Filer created with build configs but no builder was provided.');
		}
	}
	return {
		dev,
		externalsAliases: DEFAULT_EXTERNALS_ALIASES,
		mapDependencyToSourceId,
		sourcemap: true,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		watch: true,
		watcherDebounce: undefined,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger([magenta('[filer]')]),
		builder,
		buildConfigs,
		buildDir,
		sourceDirs,
		servedDirs,
	};
};

export class Filer implements BuildContext {
	// TODO think about accessors - I'm currently just making things public when I need them here
	private readonly files: Map<string, FilerFile> = new Map();
	private readonly fileExists: (id: string) => boolean = (id) => this.files.has(id);
	private readonly dirs: FilerDir[];
	private readonly builder: Builder | null;
	private readonly mapDependencyToSourceId: MapDependencyToSourceId;

	// These public `BuildContext` properties are available to e.g. builders, helpers, postprocessors.
	// This pattern lets us pass around `this` filer
	// without constantly destructuring and handling long argument lists.
	readonly buildConfigs: readonly BuildConfig[] | null;
	readonly sourceMetaById: Map<string, SourceMeta> = new Map();
	readonly log: Logger;
	readonly buildDir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget; // TODO shouldn't build configs have this?
	readonly servedDirs: readonly ServedDir[];
	readonly externalsAliases: ExternalsAliases; // TODO should this allow aliasing anything? not just externals?
	readonly state: BuilderState = {};
	readonly buildingSourceFiles: Set<string> = new Set(); // needed by hacky externals code, used to check if the filer is busy

	constructor(opts: InitialOptions) {
		const {
			dev,
			builder,
			buildConfigs,
			buildDir,
			sourceDirs,
			servedDirs,
			externalsAliases,
			mapDependencyToSourceId,
			sourcemap,
			target,
			watch,
			watcherDebounce,
			log,
		} = initOptions(opts);
		this.dev = dev;
		this.builder = builder;
		this.buildConfigs = buildConfigs;
		this.buildDir = buildDir;
		this.mapDependencyToSourceId = mapDependencyToSourceId;
		this.externalsAliases = externalsAliases;
		this.sourcemap = sourcemap;
		this.target = target;
		this.log = log;
		this.dirs = createFilerDirs(
			sourceDirs,
			servedDirs,
			buildDir,
			this.onDirChange,
			watch,
			watcherDebounce,
		);
		this.servedDirs = servedDirs;
		log.trace('servedDirs', servedDirs);
	}

	// Searches for a file matching `path`, limited to the directories that are served.
	async findByPath(path: string): Promise<BaseFilerFile | null> {
		const {files} = this;
		for (const servedDir of this.servedDirs) {
			const id = `${servedDir.servedAt}/${path}`;
			const file = files.get(id);
			if (file === undefined) {
				this.log.trace(`findByPath: miss: ${id}`);
			} else {
				this.log.trace(`findByPath: found: ${id}`);
				return file;
			}
		}
		this.log.trace(`findByPath: not found: ${path}`);
		return null;
	}

	close(): void {
		for (const dir of this.dirs) {
			dir.close();
		}
	}

	private initializing: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.initializing) return this.initializing;
		this.log.trace(blue('init'));
		let finishInitializing: () => void;
		this.initializing = new Promise((r) => (finishInitializing = r));

		await Promise.all([initSourceMeta(this), lexer.init]);
		// this.log.trace('inited cache');

		// This initializes all files in the filer's directories, loading them into memory,
		// including files to be served, source files, and build files.
		// Initializing the dirs must be done after `this.initSourceMeta`
		// because it creates source files, which need `this.sourceMeta` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// this.log.trace('inited files');

		// Now that the source meta and source files are loaded into memory,
		// check if any source files have been deleted since the last run.
		await cleanSourceMeta(this, this.fileExists);
		// this.log.trace('cleaned');

		// This initializes the builders. Should be done before the builds are initialized.
		// TODO does this belong in `dir.init`? or parallel with .. what?
		// what data is not yet ready? does this belong inside `initBuilds`?
		if (this.buildConfigs !== null) {
			for (const dir of this.dirs) {
				if (!dir.buildable) continue;
				if (this.builder!.init !== undefined) {
					await this.builder!.init(this);
				}
			}
		}

		// This performs initial source file build, traces deps,
		// and populates the `buildConfigs` property of all source files.
		await this.initBuilds();
		// this.log.trace('inited builds');
		// this.log.info('buildConfigs', this.buildConfigs);

		// TODO check if `src/` has any conflicting dirs like `src/externals`

		// this.log.trace(blue('initialized!'));

		finishInitializing!();
	}

	// During initialization, after all files are loaded into memory,
	// this is called to populate the `buildConfigs` property of all source files.
	// It traces the dependencies starting from each `buildConfig.input`,
	// building each input source file and populating its `buildConfigs`,
	// recursively until all dependencies have been handled.
	private async initBuilds(): Promise<void> {
		if (this.buildConfigs === null) return;

		const promises: Promise<void>[] = [];

		const filters: ((id: string) => boolean)[] = [];
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
				assertBuildableSourceFile(file);
				if (!file.buildConfigs.has(buildConfig)) {
					promises.push(this.addSourceFileToBuild(file, buildConfig, true));
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
						const buildConfig = filterBuildConfigs[i];
						if (!file.buildConfigs.has(buildConfig)) {
							promises.push(this.addSourceFileToBuild(file, buildConfig, true));
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
		buildConfig: BuildConfig,
		isInput: boolean,
	): Promise<void> {
		// this.log.trace(
		// 	`adding source file to build ${printBuildConfig(buildConfig)} ${gray(sourceFile.id)}`,
		// );
		if (sourceFile.buildConfigs.has(buildConfig)) {
			throw Error(
				`Already has buildConfig ${printBuildConfig(buildConfig)}: ${gray(sourceFile.id)}`,
			);
		}
		// Add the build config. The caller is expected to check to avoid duplicates.
		sourceFile.buildConfigs.add(buildConfig);
		// Add the build config as an input if appropriate, initializing the set if needed.
		// We need to determine `isInputToBuildConfig` independently of the caller,
		// because the caller may not
		if (isInput) {
			if (sourceFile.isInputToBuildConfigs === null) {
				// Cast to keep the `readonly` modifier outside of initialization.
				(sourceFile as Assignable<
					BuildableSourceFile,
					'isInputToBuildConfigs'
				>).isInputToBuildConfigs = new Set();
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
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
		shouldUpdateSourceMeta = true,
	): Promise<void> {
		this.log.trace(
			`removing source file from build ${printBuildConfig(buildConfig)} ${gray(sourceFile.id)}`,
		);

		await this.updateBuildFiles(sourceFile, [], buildConfig);

		const deleted = sourceFile.buildConfigs.delete(buildConfig);
		if (!deleted) {
			throw Error(`Expected to delete buildConfig ${buildConfig}: ${sourceFile.id}`);
		}
		const deletedBuildFiles = sourceFile.buildFiles.delete(buildConfig);
		if (!deletedBuildFiles) {
			throw Error(`Expected to delete build files ${buildConfig}: ${sourceFile.id}`);
		}
		sourceFile.dependencies.delete(buildConfig);
		sourceFile.dependents.delete(buildConfig);
		const {onRemove} = this.builder!;
		if (onRemove) {
			try {
				await onRemove(sourceFile, buildConfig, this);
			} catch (err) {
				this.log.error('error while removing source file from builder', printError(err));
			}
		}

		if (shouldUpdateSourceMeta) {
			await updateSourceMeta(this, sourceFile);
		}
	}

	private onDirChange: FilerDirChangeCallback = async (change, filerDir) => {
		const id =
			change.path === EXTERNALS_SOURCE_ID ? EXTERNALS_SOURCE_ID : join(filerDir.dir, change.path);
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
					if (this.buildConfigs !== null && filerDir.buildable) {
						// TODO This is weird because we're blindly deleting
						// the directory for all build configs,
						// whether or not they apply for this id.
						// It could be improved by tracking tracking dirs in the Filer
						// and looking up the correct build configs.
						await Promise.all(
							this.buildConfigs.map((buildConfig) =>
								remove(toBuildOutPath(this.dev, buildConfig.name, change.path, this.buildDir)),
							),
						);
					}
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
	private async initSourceFile(file: BuildableSourceFile): Promise<void> {
		if (this.buildConfigs === null) return; // TODO is this right?
		let promises: Promise<void>[] | null = null;
		let dependentBuildConfigs: Set<BuildConfig> | null = null;
		// TODO could be sped up with some caching data structures
		for (const f of this.files.values()) {
			if (f.type !== 'source' || !f.buildable) continue;
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
			if (isInputToBuildConfig(file, buildConfig)) {
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
				: await loadContents(encoding, id);

			if (sourceFile === undefined) {
				// Memory cache is cold.
				const newSourceFile = await createSourceFile(
					id,
					encoding,
					extension,
					newSourceContents,
					filerDir,
					this.sourceMetaById.get(id),
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
						throw new UnreachableError(sourceFile);
				}
			}
			return filerDir.buildable;
		});
		this.updatingSourceFiles.set(id, promise);
		return promise;
	}

	// These are used to avoid concurrent builds for any given source file.
	// TODO maybe make these `Map<BuildConfig, Set<BuildableSourceFile>>`, initialize during `init` to avoid bookkeeping API overhead or speciality code
	private pendingBuilds: Map<BuildConfig, Set<string>> = new Map(); // value is sourceId
	private enqueuedBuilds: Map<BuildConfig, Set<string>> = new Map(); // value is sourceId

	// This wrapper function protects against race conditions
	// that could occur with concurrent builds.
	// If a file is currently being build, it enqueues the file id,
	// and when the current build finishes,
	// it removes the item from the queue and rebuilds the file.
	// The queue stores at most one build per file,
	// and this is safe given that building accepts no parameters.
	private async buildSourceFile(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		let pendingBuilds = this.pendingBuilds.get(buildConfig);
		if (pendingBuilds === undefined) {
			pendingBuilds = new Set();
			this.pendingBuilds.set(buildConfig, pendingBuilds);
		}
		let enqueuedBuilds = this.enqueuedBuilds.get(buildConfig);
		if (enqueuedBuilds === undefined) {
			enqueuedBuilds = new Set();
			this.enqueuedBuilds.set(buildConfig, enqueuedBuilds);
		}

		const {id} = sourceFile;
		if (pendingBuilds.has(id)) {
			enqueuedBuilds.add(id);
			return;
		}
		pendingBuilds.add(id);
		try {
			await this._buildSourceFile(sourceFile, buildConfig);
		} catch (err) {
			this.log.error(red('build failed'), gray(id), printError(err));
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
				await this.buildSourceFile(sourceFile, buildConfig);
			}
		}
	}

	private async _buildSourceFile(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		this.log.info('build source file', gray(sourceFile.id));

		// Compile the source file.
		let result: BuildResult<Build>;

		this.buildingSourceFiles.add(sourceFile.id); // track so we can see what the filer is doing
		try {
			result = await this.builder!.build(sourceFile, buildConfig, this);
		} catch (err) {
			this.buildingSourceFiles.delete(sourceFile.id);
			throw err;
		}
		this.buildingSourceFiles.delete(sourceFile.id);

		const newBuildFiles: BuildFile[] = result.builds.map((build) =>
			createBuildFile(build, this, result, sourceFile, buildConfig),
		);

		// Update the source file with the new build files.
		await this.updateBuildFiles(sourceFile, newBuildFiles, buildConfig);
		await updateSourceMeta(this, sourceFile);
	}

	// Updates the build files in the memory cache and writes to disk.
	private async updateBuildFiles(
		sourceFile: BuildableSourceFile,
		newBuildFiles: BuildFile[],
		buildConfig: BuildConfig,
	): Promise<void> {
		const oldBuildFiles = sourceFile.buildFiles.get(buildConfig) || null;
		const changes = diffBuildFiles(newBuildFiles, oldBuildFiles);
		sourceFile.buildFiles.set(buildConfig, newBuildFiles);
		syncBuildFilesToMemoryCache(this.files, changes);
		await Promise.all([
			syncBuildFilesToDisk(changes, this.log),
			this.updateDependencies(sourceFile, newBuildFiles, oldBuildFiles, buildConfig),
		]);
	}

	// This is like `updateBuildFiles` except
	// it's called for source files when they're being hydrated from the cache.
	// This is because the normal build process ending with `updateBuildFiles`
	// is being short-circuited for efficiency, but parts of that process are still needed.
	private async hydrateSourceFileFromCache(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		// this.log.trace('hydrate', gray(sourceFile.id));
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
		sourceFile: BuildableSourceFile,
		newBuildFiles: readonly BuildFile[],
		oldBuildFiles: readonly BuildFile[] | null,
		buildConfig: BuildConfig,
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
				if (!addedDependency.external && isExternalBrowserModule(addedDependency.buildId)) continue;
				const addedSourceId = this.mapDependencyToSourceId(addedDependency, this.buildDir);
				// ignore dependencies on self - happens with common externals
				if (addedSourceId === sourceFile.id) continue;
				let addedSourceFile = this.files.get(addedSourceId);
				if (addedSourceFile !== undefined) assertBuildableSourceFile(addedSourceFile);
				// lazily create external source file if needed
				if (addedDependency.external) {
					if (addedSourceFile === undefined) {
						addedSourceFile = await this.createExternalsSourceFile(sourceFile.filerDir);
					}
					this.updateExternalsSourceFile(addedSourceFile, addedDependency, buildConfig);
				}
				// import might point to a nonexistent file, ignore those
				if (addedSourceFile !== undefined) {
					// update `dependents` of the added file
					addDependent(sourceFile, addedSourceFile, buildConfig, addedDependency);

					// Add source file to build if needed.
					// Externals are handled separately by `updateExternalsSourceFile`, not here,
					// because they're batched for the entire build.
					// If we waited for externals to build before moving on like the normal process,
					// then that could cause cascading externals builds as the dependency tree builds.
					if (!addedSourceFile.buildConfigs.has(buildConfig) && !addedDependency.external) {
						(promises || (promises = [])).push(
							this.addSourceFileToBuild(
								addedSourceFile as BuildableSourceFile,
								buildConfig,
								isInputToBuildConfig(addedSourceFile as BuildableSourceFile, buildConfig),
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
				const removedSourceId = this.mapDependencyToSourceId(removedDependency, this.buildDir);
				// ignore dependencies on self - happens with common externals
				if (removedSourceId === sourceFile.id) continue;
				const removedSourceFile = this.files.get(removedSourceId);
				// import might point to a nonexistent file, ignore them completely
				if (removedSourceFile === undefined) continue;
				assertBuildableSourceFile(removedSourceFile);
				if (!removedSourceFile.buildConfigs.has(buildConfig)) {
					throw Error(`Expected build config ${buildConfig.name}: ${removedSourceFile.id}`);
				}

				// update `dependencies` of the source file
				let dependenciesMap = sourceFile.dependencies.get(buildConfig);
				if (dependenciesMap === undefined) {
					throw Error(`Expected dependenciesMap: ${sourceFile.id}`);
				}
				let dependencies = dependenciesMap.get(removedSourceId);
				if (dependencies === undefined) {
					throw Error(`Expected dependencies: ${removedSourceId}: ${sourceFile.id}`);
				}
				dependencies.delete(removedDependency.buildId);
				if (dependencies.size === 0) {
					dependenciesMap.delete(removedSourceId);
				}

				// update `dependents` of the removed file
				let dependentsMap = removedSourceFile.dependents.get(buildConfig);
				if (dependentsMap === undefined) {
					throw Error(`Expected dependentsMap: ${removedSourceFile.id}`);
				}
				let dependents = dependentsMap.get(sourceFile.id);
				if (dependents === undefined) {
					throw Error(`Expected dependents: ${removedSourceFile.id}: ${sourceFile.id}`);
				}
				dependents.delete(removedDependency.buildId);
				if (dependents.size === 0) {
					dependentsMap.delete(sourceFile.id);
					if (
						dependentsMap.size === 0 &&
						!removedSourceFile.isInputToBuildConfigs?.has(buildConfig) &&
						!removedDependency.external // TODO ignoring these for now, would be weird to remove only when it has none, but not handle other removals (maybe it should handle them?)
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
		this.log.trace('destroying file', gray(id));
		this.files.delete(id);
		if (sourceFile.buildable) {
			if (this.buildConfigs !== null) {
				await Promise.all(
					this.buildConfigs.map((b) =>
						sourceFile.buildConfigs.has(b)
							? this.removeSourceFileFromBuild(sourceFile, b, false)
							: null,
					),
				);
			}
			// passing `false` above to avoid writing `sourceMeta` to disk for each build -
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
							(buildConfig) => (
								// TODO this is weird because we're hydrating but not building.
								// and we're not adding to the build either - see comments above for more
								sourceFile.buildConfigs.add(buildConfig),
								this.hydrateSourceFileFromCache(sourceFile, buildConfig)
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
		buildConfig: BuildConfig,
	): Promise<void> | null {
		const {specifier} = addedDependency;
		if (specifier.startsWith(EXTERNALS_BUILD_DIR_SUBPATH)) return null;
		const buildState = getExternalsBuildState(getExternalsBuilderState(this.state), buildConfig);
		if (!buildState.specifiers.has(specifier)) {
			buildState.specifiers.add(specifier);
			const updating = queueExternalsBuild(
				sourceFile.id,
				buildState,
				this.buildingSourceFiles,
				this.log,
				async () => {
					if (sourceFile.buildConfigs.has(buildConfig)) {
						await this.buildSourceFile(sourceFile, buildConfig);
					} else {
						sourceFile.dirty = true; // force it to build
						await this.addSourceFileToBuild(sourceFile, buildConfig, false);
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

const syncBuildFilesToDisk = async (changes: BuildFileChange[], log: Logger): Promise<void> => {
	await Promise.all(
		changes.map(async (change) => {
			const {file} = change;
			let shouldOutputNewFile = false;
			if (change.type === 'added') {
				if (!(await pathExists(file.id))) {
					// log.trace('creating build file on disk', gray(file.id));
					shouldOutputNewFile = true;
				} else {
					const existingContents = await loadContents(file.encoding, file.id);
					if (!areContentsEqual(file.encoding, file.contents, existingContents)) {
						log.trace('updating stale build file on disk', gray(file.id));
						shouldOutputNewFile = true;
					} // ...else the build file on disk already matches what's in memory.
					// This can happen if the source file changed but this particular build file did not.
					// Loading the usually-stale contents into memory to check before writing is inefficient,
					// but it avoids unnecessary writing to disk and misleadingly updated file stats.
				}
			} else if (change.type === 'updated') {
				if (!areContentsEqual(file.encoding, file.contents, change.oldFile.contents)) {
					log.trace('updating build file on disk', gray(file.id));
					shouldOutputNewFile = true;
				}
			} else if (change.type === 'removed') {
				log.trace('deleting build file on disk', gray(file.id));
				return remove(file.id);
			} else {
				throw new UnreachableError(change);
			}
			if (shouldOutputNewFile) {
				await outputFile(file.id, file.contents);
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

const areContentsEqual = (encoding: Encoding, a: string | Buffer, b: string | Buffer): boolean => {
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
	sourceDirs: string[],
	servedDirs: ServedDir[],
	buildDir: string,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	watcherDebounce: number | undefined,
): FilerDir[] => {
	const dirs: FilerDir[] = [];
	for (const sourceDir of sourceDirs) {
		dirs.push(createFilerDir(sourceDir, true, onChange, watch, watcherDebounce));
	}
	for (const servedDir of servedDirs) {
		// If a `servedDir` is inside a source or externals directory,
		// it's already in the Filer's memory cache and does not need to be loaded as a directory.
		// Additionally, the same is true for `servedDir`s that are inside other `servedDir`s.
		if (
			// TODO I think these are bugged with trailing slashes -
			// note the `servedDir.dir` of `servedDir.dir.startsWith` could also not have a trailing slash!
			// so I think you add `{dir} + '/'` to both?
			!sourceDirs.find((d) => servedDir.dir.startsWith(d)) &&
			!servedDirs.find((d) => d !== servedDir && servedDir.dir.startsWith(d.dir)) &&
			!servedDir.dir.startsWith(buildDir)
		) {
			dirs.push(createFilerDir(servedDir.dir, false, onChange, watch, watcherDebounce));
		}
	}
	return dirs;
};

const isInputToBuildConfig = (
	sourceFile: BuildableSourceFile,
	buildConfig: BuildConfig,
): boolean => {
	for (const input of buildConfig.input) {
		if (typeof input === 'string' ? sourceFile.id === input : input(sourceFile.id)) {
			return true;
		}
	}
	return false;
};

const addDependent = (
	dependentSourceFile: BuildableSourceFile,
	dependencySourceFile: BuildableSourceFile,
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
	dependentSourceFile: BuildableSourceFile,
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
