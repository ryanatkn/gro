import {resolve, extname, join} from 'path';
import lexer from 'es-module-lexer';

import {FilerDir, FilerDirChangeCallback, createFilerDir} from '../build/FilerDir.js';
import {MapDependencyToSourceId, mapDependencyToSourceId} from './utils.js';
import {findFiles, remove, outputFile, pathExists, readJson} from '../fs/nodeFs.js';
import {
	EXTERNALS_BUILD_DIR,
	JSON_EXTENSION,
	JS_EXTENSION,
	paths,
	toBuildOutPath,
} from '../paths.js';
import {nulls, omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {gray, magenta, red, blue} from '../colors/terminal.js';
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
	BuildableSourceFile,
	createSourceFile,
	SourceFile,
} from './sourceFile.js';
import {BuildFile, createBuildFile, diffDependencies} from './buildFile.js';
import {BaseFilerFile, getFileContentsHash} from './baseFilerFile.js';
import {loadContents} from './load.js';
import {isExternalBrowserModule} from '../utils/module.js';
import {wrap} from '../utils/async.js';
import {
	EXTERNALS_SOURCE_ID,
	getExternalsBuilderState,
	getExternalsBuildState,
} from './externalsBuildHelpers.js';
import {queueExternalsBuild} from './externalsBuilder.js';

/*

The `Filer` is at the heart of the build system.

The `Filer` wholly owns its `buildRootDir`, `./.gro` by default.
If any files or directories change inside it without going through the `Filer`,
it may go into a corrupted state.
Corrupted states can be fixed by turning off the `Filer` and running `gro clean`.

TODO

- add tests (fully modularize as they're added, running tests for host interfaces both in memory and on the filesystem)
- probably silence a lot of the logging (or add `debug` log level?) once tests are added

*/

export type FilerFile = SourceFile | BuildFile; // TODO or `Directory`?

export interface CachedSourceInfoData {
	readonly sourceId: string;
	readonly contentsHash: string;
	readonly builds: {
		readonly id: string;
		readonly name: string;
		readonly dependencies: BuildDependency[] | null;
		readonly encoding: Encoding;
	}[];
}
export interface CachedSourceInfo {
	readonly cacheId: string; // path to the cached JSON file on disk
	readonly data: CachedSourceInfoData; // the plain JSON written to disk
}
const CACHED_SOURCE_INFO_DIR = 'src'; // so `/.gro/src/` is metadata for `/src`

export interface Options {
	dev: boolean;
	builder: Builder | null;
	sourceDirs: string[];
	servedDirs: ServedDir[];
	buildConfigs: BuildConfig[] | null;
	buildRootDir: string;
	mapDependencyToSourceId: MapDependencyToSourceId;
	sourceMap: boolean;
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
	const buildRootDir = opts.buildRootDir || paths.build; // TODO assumes trailing slash
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
							buildRootDir,
						),
				  ]),
	);
	if (sourceDirs.length === 0 && servedDirs.length === 0) {
		throw Error('Filer created with no directories to build or serve.');
	}
	if (sourceDirs.length !== 0 && buildConfigs === null) {
		throw Error('Filer created with directories to build but no build configs were provided.');
	}
	const builder = opts.builder || null;
	if (sourceDirs.length !== 0 && !builder) {
		throw Error('Filer created with directories to build but no builder was provided.');
	}
	if (builder && sourceDirs.length === 0) {
		throw Error('Filer created with a builder but no directories to build.');
	}
	return {
		dev,
		mapDependencyToSourceId,
		sourceMap: true,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		watch: true,
		watcherDebounce: undefined,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger([magenta('[filer]')]),
		builder,
		sourceDirs,
		servedDirs,
		buildConfigs,
		buildRootDir,
	};
};

export class Filer implements BuildContext {
	private readonly files: Map<string, FilerFile> = new Map();
	private readonly dirs: FilerDir[];
	private readonly cachedSourceInfo: Map<string, CachedSourceInfo> = new Map();
	private readonly buildConfigs: readonly BuildConfig[] | null;
	private readonly mapDependencyToSourceId: MapDependencyToSourceId;

	// These public `BuildContext` properties are available to e.g. builders, helpers, postprocessors.
	// This pattern lets us pass around `this` filer
	// without constantly destructuring and handling long argument lists.
	readonly log: Logger;
	readonly buildRootDir: string;
	readonly dev: boolean;
	readonly sourceMap: boolean;
	readonly target: EcmaScriptTarget; // TODO shouldn't build configs have this?
	readonly servedDirs: readonly ServedDir[];
	readonly state: BuilderState = {};
	readonly buildingSourceFiles: Set<string> = new Set(); // needed by hacky externals code, used to check if the filer is busy

	constructor(opts: InitialOptions) {
		const {
			dev,
			builder,
			buildConfigs,
			buildRootDir,
			mapDependencyToSourceId,
			sourceDirs,
			servedDirs,
			sourceMap,
			target,
			watch,
			watcherDebounce,
			log,
		} = initOptions(opts);
		this.dev = dev;
		this.buildConfigs = buildConfigs;
		this.buildRootDir = buildRootDir;
		this.mapDependencyToSourceId = mapDependencyToSourceId;
		this.sourceMap = sourceMap;
		this.target = target;
		this.log = log;
		this.dirs = createFilerDirs(
			sourceDirs,
			servedDirs,
			builder,
			buildRootDir,
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

		await Promise.all([this.initCachedSourceInfo(), lexer.init]);
		// this.log.trace('inited cache');

		// This initializes all files in the filer's directories, loading them into memory,
		// including files to be served, source files, and build files.
		// Initializing the dirs must be done after `this.initCachedSourceInfo`
		// because it creates source files, which need `this.cachedSourceInfo` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// this.log.trace('inited files');

		// Now that the cached source info and source files are loaded into memory,
		// check if any source files have been deleted since the last run.
		await this.cleanCachedSourceInfo();
		// this.log.trace('cleaned');

		// This initializes the builders. Should be done before the builds are initialized.
		// TODO does this belong in `dir.init`? or parallel with .. what?
		if (this.buildConfigs !== null) {
			for (const dir of this.dirs) {
				if (!dir.buildable) continue;
				if (dir.builder.init !== undefined) {
					await dir.builder.init(this, this.buildConfigs);
				}
			}
		}

		// This performs initial source file build, traces deps,
		// and populates the `buildConfigs` property of all source files.
		await this.initBuilds();
		// this.log.trace('inited builds');
		// this.log.info('buildConfigs', this.buildConfigs);

		// TODO check if `src/` has any conflicting dirs like `src/externals`

		this.log.trace(blue('initialized!'));

		finishInitializing!();
	}

	private async initCachedSourceInfo(): Promise<void> {
		const cachedSourceInfoDir = `${this.buildRootDir}${CACHED_SOURCE_INFO_DIR}`;
		if (!(await pathExists(cachedSourceInfoDir))) return;
		const files = await findFiles(cachedSourceInfoDir, undefined, null);
		await Promise.all(
			Array.from(files.entries()).map(async ([path, stats]) => {
				if (stats.isDirectory()) return;
				const cacheId = `${cachedSourceInfoDir}/${path}`;
				const data: CachedSourceInfoData = await readJson(cacheId);
				this.cachedSourceInfo.set(data.sourceId, {cacheId, data});
			}),
		);
	}

	// Cached source info may be stale if any source files were moved or deleted
	// since the last time the Filer ran.
	// We can simply delete any cached info that doesn't map back to a source file.
	private async cleanCachedSourceInfo(): Promise<void> {
		let promises: Promise<void>[] | null = null;
		for (const sourceId of this.cachedSourceInfo.keys()) {
			if (!this.files.has(sourceId) && !isExternalBrowserModule(sourceId)) {
				this.log.warn('deleting unknown cached source info', gray(sourceId));
				(promises || (promises = [])).push(this.deleteCachedSourceInfo(sourceId));
			}
		}
		if (promises !== null) await Promise.all(promises);
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
				if (!file) {
					throw Error(`Build config ${printBuildConfig(buildConfig)} has unknown input '${input}'`);
				}
				if (file.type !== 'source') {
					throw Error(
						`Build config ${printBuildConfig(buildConfig)} has non-source input '${input}'`,
					);
				}
				if (!file.buildable) {
					throw Error(
						`Build config ${printBuildConfig(buildConfig)} has non-buildable input '${input}'`,
					);
				}
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
		await this.waitForExternals();
	}

	// Adds a build config to a source file.
	// The caller is expected to check to avoid duplicates.
	private async addSourceFileToBuild(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
		isInput: boolean,
	): Promise<void> {
		this.log.trace(
			`adding source file to build ${printBuildConfig(buildConfig)} ${gray(sourceFile.id)}`,
		);
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
				(sourceFile as Writable<
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
	): Promise<void> {
		this.log.trace(
			`removing source file from build ${printBuildConfig(buildConfig)} ${gray(sourceFile.id)}`,
		);
		if (sourceFile.isInputToBuildConfigs?.has(buildConfig)) {
			throw Error(
				`Removing build configs from input files is not allowed: ${buildConfig}: ${sourceFile.id}`,
			);
		}

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
		const {onRemove} = sourceFile.filerDir.builder;
		if (onRemove) {
			try {
				await onRemove(sourceFile, buildConfig, this);
			} catch (err) {
				this.log.error('error while removing source file from builder', printError(err));
			}
		}

		await this.updateCachedSourceInfo(sourceFile);
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
						if (file === undefined || file.type !== 'source' || !file.buildable) {
							throw Error(`Expected a buildable source file: ${id}`);
						}
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
								remove(toBuildOutPath(this.dev, buildConfig.name, change.path, this.buildRootDir)),
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
			for (const [buildConfig, dependencies] of f.dependencies) {
				if (dependencies.has(file.id)) {
					(dependentBuildConfigs || (dependentBuildConfigs = new Set())).add(buildConfig);
				}
			}
		}
		let inputBuildConfigs: Set<BuildConfig> | null = null;
		for (const buildConfig of this.buildConfigs) {
			if (isInputToBuildConfig(file, buildConfig)) {
				(inputBuildConfigs || (inputBuildConfigs = new Set())).add(buildConfig);
				console.log(red('init source file 1'), file.id);
				(promises || (promises = [])).push(this.addSourceFileToBuild(file, buildConfig, true));
			}
		}
		if (dependentBuildConfigs !== null) {
			for (const buildConfig of dependentBuildConfigs) {
				if (inputBuildConfigs?.has(buildConfig)) continue;
				console.log(red('init source file 2'), file.id);
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
				if (sourceFile.type !== 'source') {
					throw Error(`Expected to update a source file but got type '${sourceFile.type}': ${id}`);
				}
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
					this.cachedSourceInfo.get(id),
					this.buildConfigs,
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
			console.log('enqueueing id', id); // TODO I think we want to intercept for externals
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
			// TODO wait is this a source of inefficiency?
			// should we check to see if it needs to be built again,
			// or if we should just return the pending promise,
			// like in `updateSourceFile`?
			// maybe have an explicit `invalidate` semantics?

			// Something changed during the build for this file, so recurse.
			// This sequencing ensures that any awaiting callers always see the final version.
			// TODO do we need to detect cycles? if we run into any, probably
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
		if (sourceFile.id === 'externals') {
			console.log('externals buildstates', this.state.externals?.buildStates);
		}

		// Compile the source file.
		let result: BuildResult<Build>;

		this.buildingSourceFiles.add(sourceFile.id); // track so we can see what the filer is doing
		try {
			result = await sourceFile.filerDir.builder.build(sourceFile, buildConfig, this);
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
		await this.updateCachedSourceInfo(sourceFile);
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
		// TODO use the diffed set of files to do the automatic cleaning of the .gro directory in total?
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
		if (sourceFile.id === 'externals') {
			console.log(red('updateDependencies enter'), sourceFile.id);
		}

		const {addedDependencies, removedDependencies} =
			diffDependencies(newBuildFiles, oldBuildFiles) || nulls;

		let promises: Promise<void>[] | null = null;

		// handle added dependencies
		if (addedDependencies !== null) {
			for (const addedDependency of addedDependencies) {
				// `external` will be false for Node imports in non-browser contexts -
				// we create no source file for them
				// buildConfig.platform === 'browser'; // TODO may be `external` but not browser, is relying on the check against `buildId`, doesn't seem ideal
				if (!addedDependency.external && isExternalBrowserModule(addedDependency.buildId)) continue;
				const addedSourceId = this.mapDependencyToSourceId(addedDependency, this.buildRootDir);
				// ignore dependencies on self - happens with common externals
				if (addedSourceId === sourceFile.id) {
					// TODO should these be checked upstream in the diffing?
					console.log('TODO ignoring added self dependency', addedSourceId);
					continue;
				}
				let addedSourceFile = this.files.get(addedSourceId);
				if (addedSourceFile !== undefined) assertBuildableSourceFile(addedSourceFile);
				// lazily create external source file if needed
				if (addedDependency.external) {
					if (addedSourceFile === undefined) {
						// TODO wait I think we can create the externals file here,
						// but also defer its loading of build files, hydrating or whatever,
						// just like we do in `updateExternalsSourceFile`.
						// should those be combined then?
						addedSourceFile = await this.createExternalsSourceFile(
							addedSourceId,
							// addedDependency.buildId, // TODO need to associate this build ID to the source file - maybe change helper to `addExternalDependency()`
							sourceFile.filerDir,
						);
						console.log(red('TODO blocking externals source file created!'), addedSourceId);
					}
					this.updateExternalsSourceFile(addedSourceFile, addedDependency, buildConfig);
				}
				// import might point to a nonexistent file, ignore those
				if (addedSourceFile !== undefined) {
					let dependents = addedSourceFile.dependents.get(buildConfig);
					if (dependents === undefined) {
						dependents = new Set();
						addedSourceFile.dependents.set(buildConfig, dependents);
					}
					dependents.add(sourceFile);
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

				// TODO this is done above .. I think that's what we want
				// ignore dependencies on self - happens with common externals
				// if (addedSourceId !== sourceFile.id) {
				let dependencies = sourceFile.dependencies.get(buildConfig);
				if (dependencies === undefined) {
					dependencies = new Set();
					sourceFile.dependencies.set(buildConfig, dependencies);
				}
				dependencies.add(addedSourceId);
				// }
			}
		}
		if (removedDependencies !== null) {
			// TODO this is a gross hack for externals
			// TODO don't we have a similar but more subtle problem with multiple files from a build?
			let _hasExternals: boolean | undefined;
			const hasExternals = (): boolean => {
				if (_hasExternals !== undefined) return _hasExternals;
				for (const newBuildFile of newBuildFiles) {
					if (newBuildFile.dependenciesByBuildId !== null) {
						for (const dependency of newBuildFile.dependenciesByBuildId.values()) {
							if (dependency.external) {
								_hasExternals = true;
								return _hasExternals;
							}
						}
					}
				}
				_hasExternals = false;
				return _hasExternals;
			};
			for (const removedDependency of removedDependencies) {
				const removedSourceId = this.mapDependencyToSourceId(removedDependency, this.buildRootDir);
				// TODO this is wrong!!!!!!!! it still has other external deps!
				console.log('removedSourceId', removedSourceId, sourceFile.id);
				// ignore dependencies on self - happens with common externals
				if (removedSourceId === sourceFile.id) {
					// TODO should these be checked upstream in the diffing?
					console.log('TODO ignoring removed self dependency', removedSourceId);
					continue;
				}
				if (removedSourceId === EXTERNALS_SOURCE_ID) {
					// TODO uh oh..this was not made for M:N building!
					// the problem here is that it's de-duping by build id, not source,
					// so all externals are clobbering each other right here
					console.log(red('externals source id'));
					if (hasExternals()) continue;
				}
				const removedSourceFile = this.files.get(removedSourceId);
				if (removedSourceFile === undefined) continue; // import might point to a nonexistent file
				assertBuildableSourceFile(removedSourceFile);

				// if (removedSourceId !== sourceFile.id) {
				let dependencies = sourceFile.dependencies.get(buildConfig);
				if (dependencies === undefined) {
					// debugger;
					// console.log('removedSourceFile', removedSourceFile);
					throw Error(`Expected dependencies: ${printBuildConfig(buildConfig)}: ${sourceFile.id}`);
				}
				dependencies.delete(removedSourceId);
				// }

				// TODO
				// wait should we be mapping at all?
				// wait should we be mapping at all?
				// wait should we be mapping at all?
				// wait should we be mapping at all?
				// wait should we be mapping at all?
				// wait should we be mapping at all? or using build ids. properly handle multiple build files
				// the diffing with `diffDependencies` is all build ids!
				if (!removedSourceFile.buildConfigs.has(buildConfig)) {
					debugger;
					console.log('removedDependency', removedDependency);
					console.log('buildConfig, removedSourceFile.id', buildConfig, removedSourceFile.id);
					throw Error(
						`Expected build config: ${printBuildConfig(buildConfig)}: ${removedSourceFile.id}`,
					);
				}
				let dependents = removedSourceFile.dependents.get(buildConfig);
				if (dependents === undefined) {
					throw Error(
						`Expected dependents: ${printBuildConfig(buildConfig)}: ${removedSourceFile.id}`,
					);
				}
				dependents.delete(sourceFile); // TODO should these be build ids instead? what about dependencies, build ids too?
				if (dependents.size === 0 && !removedSourceFile.isInputToBuildConfigs?.has(buildConfig)) {
					(promises || (promises = [])).push(
						this.removeSourceFileFromBuild(removedSourceFile, buildConfig),
					);
				}
			}
		}
		if (promises !== null) await Promise.all(promises); // TODO parallelize with syncing to disk below (in `updateBuildFiles()`)?
		console.log('updateDependencies exit', sourceFile.id);
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile || sourceFile.type !== 'source') return; // ignore build files (maybe throw an error if the file isn't found, should not happen)
		this.log.trace('destroying file', gray(id));
		this.files.delete(id);
		if (sourceFile.buildable) {
			if (this.buildConfigs !== null) {
				await Promise.all(this.buildConfigs.map((b) => this.updateBuildFiles(sourceFile, [], b)));
			}
			await this.deleteCachedSourceInfo(sourceFile.id);
		}
	}

	// TODO can we remove this thing completely, treating externals like all others?
	// It seems not, because the `Filer` currently does not handle multiple source files
	// per build, it's 1:N not M:N, and further the externals build lazily,
	// so we probably need to refactor, ultimately into a plugin system.
	private async createExternalsSourceFile(
		id: string,
		filerDir: FilerDir,
	): Promise<BuildableSourceFile> {
		if (this.files.has(id)) throw Error(`Expected to create source file: ${id}`);
		await this.updateSourceFile(id, filerDir); // TODO use the return value?
		const sourceFile = this.files.get(id);
		assertBuildableSourceFile(sourceFile);
		if (sourceFile.buildFiles.size > 0) {
			await Promise.all(
				Array.from(sourceFile.buildFiles.keys()).map((buildConfig) =>
					this.hydrateSourceFileFromCache(sourceFile, buildConfig),
				),
			);
		}
		return sourceFile;
		// TODO tried this but no, because `initSourceFile` is not what we want,
		// and we didn't awnt to special case hydration,
		// but this does suggest we should refactor all of it.
		// // TODO helper or something
		// await this.onDirChange({type: 'create', path: id, stats: {isDirectory: () => false}}, filerDir);
		// const file = this.files.get(id);
		// assertBuildableSourceFile(file);
		// console.log(red('created!'), id);
		// // TODO hydrate? is the `initSourceFile` in the `onDirChange` actually what we want?s
		// return file;
		// this.log.trace('creating external source file', gray(id));
	}

	// TODO this could possibly be changed to explicitly call the build,
	// instead of waiting with timeouts in places,
	// and it'd be specific to one ExternalsBuildState, so it'd be per build config.
	// we could then remove things like the tracking what's building in the Filer and externalsBuidler
	private updatingExternals: Promise<void>[] = [];
	private async waitForExternals(): Promise<void> {
		if (this.updatingExternals.length === 0) return;
		await Promise.all(this.updatingExternals);
		this.updatingExternals.length = 0;
	}

	// TODO try to refactor this, maybe merge into `updateSourceFile`?
	// could we use `contents` instead of `specifiers`,
	// or should this be better abstracted?
	private updateExternalsSourceFile(
		sourceFile: BuildableSourceFile,
		addedDependency: BuildDependency,
		buildConfig: BuildConfig,
	): Promise<void> | null {
		const {specifier} = addedDependency;
		// TODO could also do something with "addedDependency.common" in postprocess
		// maybe `isExternalImport` - see that comment there - if it's NOT an external import...
		if (specifier.startsWith(`/${EXTERNALS_BUILD_DIR}/`)) return null;

		// TODO diff the cached import map specifiers against the current state - if different, build, if not, no-op!
		const buildState = getExternalsBuildState(getExternalsBuilderState(this.state), buildConfig);

		// TODO basically..what we want, is when a file is finished building,
		// we want some callback logic to run - the logic is like,
		// "if there are no other pending builds other than this one, proceed with the externals build"
		// this.pendingBuilds2.get(buildConfig)!.delete(id);
		// if (this.pendingBuilds2.get(buildConfig)!.size === 0) {
		// 	// account for this one!!
		// 	...
		// }

		// TODO should we use `contents` to do this the normal way?
		// just queue an `update` check? what if we called `onDirChange`?
		// unfortunately, no! I tried this, and the problem is that `onDirChange`
		// occurs in the context of a source file and all of its builds,
		// (because Gro has a 1:N sourceFile:buildFiles model)
		// but here we're in the context of a single build.
		// maybe there's another way..? ..! ...

		if (!buildState.specifiers.has(specifier)) {
			console.log(red('adding specifier'), specifier, sourceFile.id);
			buildState.specifiers.add(specifier);
			// now that we mutated the specifiers, update the source file,
			// which derives the `contents` of the externals source file from the specifiers
			console.log('should build externals!', specifier);

			const updating = queueExternalsBuild(
				sourceFile.id,
				buildState,
				this.buildingSourceFiles,
				this.log,
				async () => {
					// TODO or hydrate? is that the problem?
					// I think yeah so, we use this same
					// detection logic for hydration inside `addSourceFileToBuild`
					if (sourceFile.buildConfigs.has(buildConfig)) {
						console.log(red('updateExternalsSourceFile BUILDING'), addedDependency.specifier);
						await this.buildSourceFile(sourceFile, buildConfig);
					} else {
						console.log(
							red('updateExternalsSourceFile ADDING TO BUILD'),
							addedDependency.specifier,
						);
						// TODO I think this works? forces it to build? because we added the specifier
						// this is basically a param to the function, "forceBuild"
						sourceFile.dirty = true;
						await this.addSourceFileToBuild(sourceFile, buildConfig, false);
					}
					console.log(red('updateExternalsSourceFile BUILT!!!!!!'), addedDependency.specifier);
				},
			);
			this.updatingExternals.push(updating);
			return updating;
		}
		return null;
	}

	// TODO as an optimization, this should be debounced per file,
	// because we're writing per build config.
	private async updateCachedSourceInfo(file: BuildableSourceFile): Promise<void> {
		if (file.buildConfigs.size === 0) return this.deleteCachedSourceInfo(file.id);
		const cacheId = toCachedSourceInfoId(file, this.buildRootDir);
		const data: CachedSourceInfoData = {
			sourceId: file.id,
			contentsHash: getFileContentsHash(file),
			builds: Array.from(file.buildFiles.values()).flatMap((files) =>
				files.map((file) => ({
					id: file.id,
					name: file.buildConfig.name,
					dependencies:
						file.dependenciesByBuildId && Array.from(file.dependenciesByBuildId.values()),
					encoding: file.encoding,
				})),
			),
		};
		const cachedSourceInfo: CachedSourceInfo = {cacheId, data};
		// This is useful for debugging, but has false positives
		// when source changes but output doesn't, like if comments get elided.
		// if (
		// 	(await pathExists(cacheId)) &&
		// 	deepEqual(await readJson(cacheId), cachedSourceInfo)
		// ) {
		// 	console.log(
		// 		'wasted build detected! unchanged file was built and identical source info written to disk: ' +
		// 			cacheId,
		// 	);

		// }
		this.cachedSourceInfo.set(file.id, cachedSourceInfo);
		// this.log.trace('outputting cached source info', gray(cacheId));
		await outputFile(cacheId, JSON.stringify(data, null, 2));
	}

	private async deleteCachedSourceInfo(sourceId: string): Promise<void> {
		const info = this.cachedSourceInfo.get(sourceId);
		if (info === undefined) return; // silently do nothing, which is fine because it's a cache
		this.cachedSourceInfo.delete(sourceId);
		return remove(info.cacheId);
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
					const existingCotents = await loadContents(file.encoding, file.id);
					if (!areContentsEqual(file.encoding, file.contents, existingCotents)) {
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
				// TODO this is handled upstream, but go find it
				// oldFile.sourceId !== COMMON_SOURCE_ID
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

const toCachedSourceInfoId = (file: BuildableSourceFile, buildRootDir: string): string =>
	`${buildRootDir}${CACHED_SOURCE_INFO_DIR}/${file.dirBasePath}${file.filename}${JSON_EXTENSION}`;

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
// TODO maybe change to sets?
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
	builder: Builder | null,
	buildRootDir: string,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	watcherDebounce: number | undefined,
): FilerDir[] => {
	const dirs: FilerDir[] = [];
	for (const sourceDir of sourceDirs) {
		dirs.push(createFilerDir(sourceDir, builder, onChange, watch, watcherDebounce));
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
			!servedDir.dir.startsWith(buildRootDir)
		) {
			dirs.push(createFilerDir(servedDir.dir, null, onChange, watch, watcherDebounce));
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
