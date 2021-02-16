import {resolve, extname, join} from 'path';
import lexer from 'es-module-lexer';

import {
	FilerDir,
	FilerDirChangeCallback,
	createFilerDir,
	ExternalsFilerDir,
} from '../build/FilerDir.js';
import {MapBuildIdToSourceId, mapBuildIdToSourceId} from './utils.js';
import {findFiles, remove, outputFile, pathExists, readJson} from '../fs/nodeFs.js';
import {
	EXTERNALS_BUILD_DIR,
	hasSourceExtension,
	JSON_EXTENSION,
	JS_EXTENSION,
	paths,
	toBuildOutPath,
} from '../paths.js';
import {nulls, omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta, red} from '../colors/terminal.js';
import {printError, printPath} from '../utils/print.js';
import type {Builder} from './builder.js';
import {Encoding, inferEncoding} from '../fs/encoding.js';
import {BuildConfig} from '../config/buildConfig.js';
import {stripEnd, stripStart} from '../utils/string.js';
import {EcmaScriptTarget, DEFAULT_ECMA_SCRIPT_TARGET} from './tsBuildHelpers.js';
import {ServedDir, ServedDirPartial, toServedDirs} from './ServedDir.js';
import {
	BuildableExternalsSourceFile,
	BuildableSourceFile,
	createSourceFile,
	SourceFile,
} from './sourceFile.js';
import {BuildFile, createBuildFile, DependencyInfo, diffDependencies} from './buildFile.js';
import {BaseFilerFile, getFileContentsHash} from './baseFilerFile.js';
import {loadContents} from './load.js';
// import './includeme.js';

export type FilerFile = SourceFile | BuildFile; // TODO or Directory? source/compiled directory?

export interface CachedSourceInfoData {
	sourceId: string;
	contentsHash: string;
	builds: {
		id: string;
		name: string;
		localDependencies: string[] | null;
		externalDependencies: string[] | null;
		encoding: Encoding;
	}[];
}
export interface CachedSourceInfo {
	cacheId: string; // path to the cached JSON file on disk
	data: CachedSourceInfoData; // the plain JSON written to disk
}
const CACHED_SOURCE_INFO_DIR = 'cachedSourceInfo';

export interface Options {
	dev: boolean;
	builder: Builder | null;
	compiledDirs: string[];
	externalsDir: string | null;
	servedDirs: ServedDir[];
	buildConfigs: BuildConfig[] | null;
	externalsBuildConfig: BuildConfig | null;
	buildRootDir: string;
	mapBuildIdToSourceId: MapBuildIdToSourceId;
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
	const externalsBuildConfig =
		opts.externalsBuildConfig || buildConfigs === null
			? null
			: buildConfigs.find((c) => c.primary && c.platform === 'browser') ||
			  buildConfigs.find((c) => c.primary && c.platform === 'node') ||
			  buildConfigs.find((c) => c.primary) ||
			  buildConfigs[0];
	const buildRootDir = opts.buildRootDir || paths.build; // TODO assumes trailing slash
	const compiledDirs = opts.compiledDirs ? opts.compiledDirs.map((d) => resolve(d)) : [];
	const externalsDir =
		externalsBuildConfig === null || opts.externalsDir === null
			? null
			: opts.externalsDir === undefined
			? `${buildRootDir}${EXTERNALS_BUILD_DIR}`
			: resolve(opts.externalsDir);
	validateDirs(compiledDirs, externalsDir, buildRootDir);
	const compiledDirCount = compiledDirs.length + (externalsDir === null ? 0 : 1);
	// default to serving all of the compiled output files
	const servedDirs = toServedDirs(
		opts.servedDirs ||
			(buildConfigs === null
				? []
				: [
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
		externalsDir,
		buildRootDir,
	);
	console.log('servedDirs', servedDirs);
	if (compiledDirCount === 0 && servedDirs.length === 0) {
		throw Error('Filer created with no directories to compile or serve.');
	}
	if (compiledDirCount !== 0 && buildConfigs === null) {
		throw Error('Filer created with directories to compile but no build configs were provided.');
	}
	const builder = opts.builder || null;
	if (compiledDirCount !== 0 && !builder) {
		throw Error('Filer created with directories to compile but no builder was provided.');
	}
	if (builder && compiledDirCount === 0) {
		throw Error('Filer created with a builder but no directories to compile.');
	}
	return {
		dev,
		mapBuildIdToSourceId,
		sourceMap: true,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		watch: true,
		watcherDebounce: undefined,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger([magenta('[filer]')]),
		builder,
		compiledDirs,
		externalsDir,
		servedDirs,
		buildConfigs,
		externalsBuildConfig,
		buildRootDir,
	};
};

export class Filer {
	private readonly files: Map<string, FilerFile> = new Map();
	private readonly dirs: FilerDir[];
	private readonly cachedSourceInfo: Map<string, CachedSourceInfo> = new Map();
	private readonly externalsDir: ExternalsFilerDir | null;
	private readonly externalsServedDir: ServedDir | null;
	private readonly buildConfigs: BuildConfig[] | null;
	private readonly externalsBuildConfig: BuildConfig | null;
	private readonly mapBuildIdToSourceId: MapBuildIdToSourceId;
	private readonly cleanOutputDirs: boolean;
	private readonly log: Logger;

	// public properties available to e.g. builders and postprocessors
	readonly buildRootDir: string;
	readonly dev: boolean;
	readonly sourceMap: boolean;
	readonly target: EcmaScriptTarget;
	readonly externalsDirBasePath: string;
	readonly servedDirs: readonly ServedDir[];

	constructor(opts: InitialOptions) {
		const {
			dev,
			builder,
			buildConfigs,
			externalsBuildConfig,
			buildRootDir,
			mapBuildIdToSourceId,
			compiledDirs,
			servedDirs,
			externalsDir,
			sourceMap,
			target,
			watch,
			watcherDebounce,
			cleanOutputDirs,
			log,
		} = initOptions(opts);
		this.dev = dev;
		this.buildConfigs = buildConfigs;
		this.externalsBuildConfig = externalsBuildConfig;
		this.buildRootDir = buildRootDir;
		this.mapBuildIdToSourceId = mapBuildIdToSourceId;
		this.sourceMap = sourceMap;
		this.target = target;
		this.cleanOutputDirs = cleanOutputDirs;
		this.log = log;
		this.dirs = createFilerDirs(
			compiledDirs,
			servedDirs,
			externalsDir,
			builder,
			buildRootDir,
			this.onDirChange,
			watch,
			watcherDebounce,
		);
		this.servedDirs = servedDirs;
		this.externalsDir =
			externalsDir === null
				? null
				: (this.dirs.find((d) => d.dir === externalsDir) as ExternalsFilerDir);
		this.externalsServedDir = servedDirs.find((d) => d.dir === externalsDir) || null;
		this.externalsDirBasePath =
			this.externalsDir === null || this.externalsServedDir === null
				? ''
				: stripStart(this.externalsDir.dir, `${this.externalsServedDir.servedAt}/`);
	}

	// Searches for a file matching `path`, limited to the directories that are served.
	async findByPath(path: string): Promise<BaseFilerFile | null> {
		const {files} = this;
		for (const servedDir of this.servedDirs) {
			const id = `${servedDir.servedAt}/${path}`;
			this.log.trace(`findByPath: checking: ${id}`);
			const file = files.get(id);
			if (file !== undefined) {
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
		// this.log.trace('initalizing...');
		let finishInitializing: () => void;
		this.initializing = new Promise((r) => (finishInitializing = r));

		await Promise.all([this.initCachedSourceInfo(), lexer.init]);
		// this.log.trace('inited cache');
		// Initializing the dirs must be done after `this.initCachedSourceInfo`
		// because it creates source files, which need `this.cachedSourceInfo` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// this.log.trace('inited files');

		// Now that the cached source info and source files are loaded into memory,
		// check if any source files have been deleted since the last run.
		await this.cleanCachedSourceInfo();
		// this.log.trace('cleaned');

		// This performs initial source file compilation, traces deps,
		// and populates the `buildConfigs` property of all source files.
		await this.initBuilds();
		// this.log.trace('inited builds');
		// this.log.info('buildConfigs', this.buildConfigs);

		// Clean the dev output directories,
		// removing any files that can't be mapped back to source files.
		if (this.cleanOutputDirs && this.buildConfigs !== null) {
			await Promise.all(
				this.buildConfigs.map(async (buildConfig) => {
					const outputDir = toBuildOutPath(this.dev, buildConfig.name, '', this.buildRootDir);
					if (!(await pathExists(outputDir))) return;
					const files = await findFiles(outputDir, undefined, null);
					await Promise.all(
						Array.from(files.entries()).map(async ([path, stats]) => {
							if (stats.isDirectory()) return;
							const id = join(outputDir, path);
							if (this.files.has(id)) return;
							if (hasSourceExtension(id)) {
								// TODO do we want this check? maybe perform it synchronously before any `remove` calls?
								throw Error(
									'File in output directory has unexpected source extension.' +
										' Output directories are expected to be fully owned by Gro and should not have source files.' +
										` File is ${id} in outputDir ${outputDir}`,
								);
							}
							this.log.trace('deleting unknown build file', printPath(id));
							const promises: Promise<void>[] = [remove(id)];
							const sourceFile = this.findSourceFile(id);
							if (sourceFile !== undefined) {
								if (!sourceFile.buildable) {
									throw Error(`Expected source file to be buildable: ${sourceFile.id}`);
								}
								promises.push(this.updateCachedSourceInfo(sourceFile));
							}
							await Promise.all(promises);
						}),
					);
				}),
			);
		}

		// Ensure that the externals directory does not conflict with another served directory.
		// This check must wait until the above syncing completes.
		// TODO we need to delete unknown dirs in the build directory above, not just files,
		// otherwise this error does not get cleared if you delete the conflicting directory
		if (this.externalsServedDir !== null) {
			await checkForConflictingExternalsDir(
				this.servedDirs,
				this.externalsServedDir,
				this.externalsDirBasePath,
			);
		}
		// this.log.trace('initialized!');

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
			if (!this.files.has(sourceId)) {
				(promises || (promises = [])).push(this.deleteCachedSourceInfo(sourceId));
			}
		}
		if (promises !== null) await Promise.all(promises);
	}

	// During initialization, after all files are loaded into memory,
	// this is called to populate the `buildConfigs` property of all source files.
	// It traces the dependencies starting from each `buildConfig.input`,
	// compiling each input source file and populating its `buildConfigs`,
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
					throw Error(`Build config '${buildConfig.name}' has unknown input '${input}'`);
				}
				if (file.type !== 'source') {
					throw Error(`Build config '${buildConfig.name}' has non-source input '${input}'`);
				}
				if (!file.buildable) {
					throw Error(`Build config '${buildConfig.name}' has non-buildable input '${input}'`);
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
	}

	// Adds a build config to a source file.
	// The caller is expected to check to avoid duplicates.
	private async addSourceFileToBuild(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
		isInput: boolean,
	): Promise<void> {
		if (sourceFile.sourceType === 'externals') {
			console.log('IGNORING EXTERNALS in addSourceFileToBuild', sourceFile);
			return;
		}
		if (sourceFile.buildConfigs.has(buildConfig)) {
			throw Error(`Expected to add buildConfig for ${buildConfig.name}:${sourceFile.id}`);
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
		if (!sourceFile.buildFiles.has(buildConfig)) {
			await this.buildSourceFile(sourceFile, buildConfig);
		} else {
			await this.hydrateSourceFileFromCache(sourceFile, buildConfig);
		}
	}

	// Removes a build config from a source file.
	// The caller is expected to check to avoid duplicates.
	private async removeSourceFileFromBuild(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		if (sourceFile.sourceType === 'externals') {
			console.log('IGNORING EXTERNALS in addSourceFileToBuild', sourceFile);
			return;
		}
		if (sourceFile.isInputToBuildConfigs?.has(buildConfig)) {
			throw Error(
				`Removing build configs from input files is not allowed: ${buildConfig}:${sourceFile.id}`,
			);
		}

		await this.updateBuildFiles(sourceFile, [], buildConfig);

		const deleted = sourceFile.buildConfigs.delete(buildConfig);
		if (!deleted) {
			throw Error(`Expected to delete buildConfig ${buildConfig}:${sourceFile.id}`);
		}
		const deletedBuildFiles = sourceFile.buildFiles.delete(buildConfig);
		if (!deletedBuildFiles) {
			throw Error(`Expected to delete build files ${buildConfig}:${sourceFile.id}`);
		}
		sourceFile.dependencies.delete(buildConfig);
		sourceFile.dependents.delete(buildConfig);

		await this.updateCachedSourceInfo(sourceFile);
	}

	private onDirChange: FilerDirChangeCallback = async (change, filerDir) => {
		const id =
			filerDir.type === 'externals'
				? stripEnd(change.path, JS_EXTENSION)
				: join(filerDir.dir, change.path);
		switch (change.type) {
			case 'init':
			case 'create':
			case 'update': {
				if (change.stats.isDirectory()) {
					// We could ensure the directory, but it's usually wasted work,
					// and `fs-extra` takes care of adding missing directories when writing to disk.
				} else {
					const shouldBuild = await this.updateSourceFile(id, filerDir);
					if (filerDir.type === 'externals' && change.type === 'init') {
						// TODO hacky
						// normally `hydrateSourceFileFromCache` is called on source files
						// when they're added to a build on initialization,
						// but externals are not added to build configs in the same way.
						// Is this a mistake? Should they be passing through the same
						// initialization code paths for each build config?
						// Or do they only get associated with the special externals build config?
						// problem is `this.externalsBuildConfig` doesn't look right ...
						if (!this.externalsBuildConfig) throw Error('Expected an externals build config.');
						const file = this.files.get(id);
						if (file === undefined || file.type !== 'source' || !file.buildable) {
							throw Error('Expected file to be a buildable source file.');
						}
						this.hydrateSourceFileFromCache(file, this.externalsBuildConfig);
						return;
					}
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

	// Returns a boolean indicating if the source file should be compiled.
	// The source file may have been updated or created from a cold cache.
	private async updateSourceFile(id: string, filerDir: FilerDir): Promise<boolean> {
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
						`${sourceFile.id} changed from ${sourceFile.filerDir.dir} to ${filerDir.dir}`,
				);
			}
		}

		let extension: string;
		let encoding: Encoding;
		if (sourceFile !== undefined) {
			extension = sourceFile.extension;
			encoding = sourceFile.encoding;
		} else if (filerDir.type === 'externals') {
			extension = JS_EXTENSION;
			encoding = 'utf8';
		} else {
			extension = extname(id);
			encoding = inferEncoding(extension);
		}
		const newSourceContents =
			filerDir.type === 'externals'
				? // TODO it may require additional changes,
				  // but the package.json version could be put here,
				  // allowing externals to update at runtime
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
				this.externalsBuildConfig,
			);
			this.files.set(id, newSourceFile);
			// If the created source file has its build files hydrated from the cache,
			// we assume it doesn't need to be compiled.
			if (newSourceFile.buildable && newSourceFile.buildFiles.size !== 0) {
				return false;
			}
		} else if (
			areContentsEqual(encoding, sourceFile.contents, newSourceContents) &&
			// TODO hack to avoid the comparison for externals because they're compiled lazily
			!(sourceFile.sourceType === 'externals' && sourceFile.buildFiles.size === 0)
		) {
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
	}

	// These are used to avoid concurrent compilations for any given source file.
	private pendingCompilations = new Set<string>(); // value is `buildConfig.name + sourceFileId`
	private enqueuedCompilations = new Set<string>(); // value is `buildConfig.name + sourceFileId`

	// This wrapper function protects against race conditions
	// that could occur with concurrent compilations.
	// If a file is currently being compiled, it enqueues the file id,
	// and when the current compilation finishes,
	// it removes the item from the queue and recompiles the file.
	// The queue stores at most one compilation per file,
	// and this is safe given that compiling accepts no parameters.
	private async buildSourceFile(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		const key = `${buildConfig.name}${sourceFile.id}`;
		if (this.pendingCompilations.has(key)) {
			this.enqueuedCompilations.add(key);
			return;
		}
		this.pendingCompilations.add(key);
		try {
			await this._buildSourceFile(sourceFile, buildConfig);
		} catch (err) {
			debugger;
			this.log.error(red('build failed'), printPath(sourceFile.id), printError(err));
		}
		this.pendingCompilations.delete(key);
		if (this.enqueuedCompilations.has(key)) {
			this.enqueuedCompilations.delete(key);
			// Something changed during the compilation for this file, so recurse.
			// This sequencing ensures that any awaiting callers always see the final version.
			// TODO do we need to detect cycles? if we run into any, probably
			const shouldBuild = await this.updateSourceFile(sourceFile.id, sourceFile.filerDir);
			if (shouldBuild) {
				await this.buildSourceFile(sourceFile, buildConfig);
			}
		}
	}

	private async _buildSourceFile(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		this.log.info('build source file', sourceFile.id);

		// Compile the source file.
		const result = await sourceFile.filerDir.builder.build(sourceFile, buildConfig, this);

		const newBuildFiles: readonly BuildFile[] = result.builds.map((compilation) =>
			createBuildFile(compilation, this, result, sourceFile, buildConfig),
		);

		// Update the source file with the new build files.
		await this.updateBuildFiles(sourceFile, newBuildFiles, buildConfig);
		await this.updateCachedSourceInfo(sourceFile);
	}

	// Updates the build files in the memory cache and writes to disk.
	private async updateBuildFiles(
		sourceFile: BuildableSourceFile,
		newBuildFiles: readonly BuildFile[],
		buildConfig: BuildConfig,
	): Promise<void> {
		const oldBuildFiles = sourceFile.buildFiles.get(buildConfig) || null;
		sourceFile.buildFiles.set(buildConfig, newBuildFiles);
		syncBuildFilesToMemoryCache(this.files, newBuildFiles, oldBuildFiles, this.log);
		await this.updateDependencies(sourceFile, newBuildFiles, oldBuildFiles, buildConfig);
		await syncFilesToDisk(newBuildFiles, oldBuildFiles, this.log);
	}

	// This is like `updateBuildFiles` except
	// it's called for source files when they're being hydrated from the cache.
	// This is because the normal build process ending with `updateBuildFiles`
	// is being short-circuited for efficiency, but parts of that process are still needed.
	private async hydrateSourceFileFromCache(
		sourceFile: BuildableSourceFile,
		buildConfig: BuildConfig,
	): Promise<void> {
		const buildFiles = sourceFile.buildFiles.get(buildConfig);
		if (buildFiles === undefined) {
			throw Error(`Expected to find build files when hydrating from cache.`);
		}
		syncBuildFilesToMemoryCache(this.files, buildFiles, null, this.log);
		await this.updateDependencies(sourceFile, buildFiles, null, buildConfig);
	}

	private async updateDependencies(
		sourceFile: BuildableSourceFile,
		newBuildFiles: readonly BuildFile[],
		oldBuildFiles: readonly BuildFile[] | null,
		buildConfig: BuildConfig,
	): Promise<void> {
		if (sourceFile.sourceType === 'externals') return;
		let {
			addedDependencies,
			removedDependencies,
			addedDependencySourceFiles,
			removedDependencySourceFiles,
		} = this.diffDependencies(newBuildFiles, oldBuildFiles) || nulls;
		let promises: Promise<void>[] | null = null;
		if (addedDependencies !== null) {
			for (const addedDependency of addedDependencies) {
				let dependencies = sourceFile.dependencies.get(buildConfig);
				if (dependencies === undefined) {
					dependencies = new Set();
					sourceFile.dependencies.set(buildConfig, dependencies);
				}
				const sourceId = this.mapBuildIdToSourceId(addedDependency.id, addedDependency.external);
				dependencies.add(sourceId);

				// create external source files if needed
				if (addedDependency.external && buildConfig.platform === 'browser') {
					const sourceFile = await this.addExternalDependency(sourceId);
					(addedDependencySourceFiles || (addedDependencySourceFiles = new Set())).add(sourceFile);
				}
			}
		}
		if (removedDependencies !== null) {
			for (const removedDependency of removedDependencies) {
				let dependencies = sourceFile.dependencies.get(buildConfig);
				if (dependencies === undefined) {
					throw Error(`Expected dependencies: ${buildConfig.name}:${sourceFile.id}`);
				}
				dependencies.delete(
					this.mapBuildIdToSourceId(removedDependency.id, removedDependency.external),
				);
			}
		}
		if (addedDependencySourceFiles !== null) {
			for (const addedDependencySourceFile of addedDependencySourceFiles) {
				if (
					addedDependencySourceFile.sourceType === 'externals' &&
					buildConfig.platform !== 'browser'
				) {
					continue;
				}
				let dependents = addedDependencySourceFile.dependents.get(buildConfig);
				if (dependents === undefined) {
					dependents = new Set();
					addedDependencySourceFile.dependents.set(buildConfig, dependents);
				}
				dependents.add(sourceFile);
				if (!addedDependencySourceFile.buildConfigs.has(buildConfig)) {
					(promises || (promises = [])).push(
						this.addSourceFileToBuild(
							addedDependencySourceFile,
							buildConfig,
							isInputToBuildConfig(addedDependencySourceFile, buildConfig),
						),
					);
				}
			}
		}
		if (removedDependencySourceFiles !== null) {
			for (const removedDependencySourceFile of removedDependencySourceFiles) {
				if (removedDependencySourceFile.sourceType === 'externals') continue; // TODO clean these up ever?
				if (!removedDependencySourceFile.buildConfigs.has(buildConfig)) {
					throw Error(
						`Expected build config: ${buildConfig.name}:${removedDependencySourceFile.id}`,
					);
				}
				let dependents = removedDependencySourceFile.dependents.get(buildConfig);
				if (dependents === undefined) {
					throw Error(`Expected dependents: ${buildConfig.name}:${removedDependencySourceFile.id}`);
				}
				dependents.delete(sourceFile);
				if (
					dependents.size === 0 &&
					!removedDependencySourceFile.isInputToBuildConfigs?.has(buildConfig)
				) {
					(promises || (promises = [])).push(
						this.removeSourceFileFromBuild(removedDependencySourceFile, buildConfig),
					);
				}
			}
		}

		if (promises !== null) await Promise.all(promises); // TODO parallelize with syncing to disk below (in `updateBuildFiles()`)?
	}

	diffDependencies(
		newBuildFiles: readonly BuildFile[],
		oldBuildFiles: readonly BuildFile[] | null,
	): null | {
		addedDependencies: DependencyInfo[] | null;
		removedDependencies: DependencyInfo[] | null;
		addedDependencySourceFiles: Set<BuildableSourceFile> | null;
		removedDependencySourceFiles: Set<BuildableSourceFile> | null;
	} {
		let addedDependencySourceFiles: Set<BuildableSourceFile> | null = null;
		let removedDependencySourceFiles: Set<BuildableSourceFile> | null = null;

		// After building the source file, we need to handle any dependency changes for each build file.
		// Dependencies may be added or removed,
		// and their source files need to be updated with any build config changes.
		// When a dependency is added for this build,
		// if the dependency's source file is not an input to the build config,
		// and it has 1 dependent after the build file is added,
		// they're added for this build,
		// meaning the memory cache is updated and the files are compiled to disk for the build config.
		// When a dependency is removed for this build,
		// if the dependency's source file is not an input to the build config,
		// and it has 0 dependents after the build file is removed,
		// they're removed for this build,
		// meaning the memory cache is updated and the files are deleted from disk for the build config.
		const {addedDependencies, removedDependencies} =
			diffDependencies(newBuildFiles, oldBuildFiles) || nulls;
		if (addedDependencies !== null) {
			for (const addedDependency of addedDependencies) {
				let addedSourceFile = this.findSourceFile(addedDependency.id, addedDependency.external);
				if (addedSourceFile === undefined) continue; // import might point to a nonexistent file
				if (!addedSourceFile.buildable) {
					throw Error(`Expected source file to be buildable: ${addedSourceFile.id}`);
				}
				(addedDependencySourceFiles || (addedDependencySourceFiles = new Set())).add(
					addedSourceFile,
				);
			}
		}
		if (removedDependencies !== null) {
			for (const removedDependency of removedDependencies) {
				const removedSourceFile = this.findSourceFile(
					removedDependency.id,
					removedDependency.external,
				);
				if (removedSourceFile === undefined) continue; // import might point to a nonexistent file
				if (!removedSourceFile.buildable) {
					throw Error(`Expected dependency source file to be buildable: ${removedSourceFile.id}`);
				}
				(removedDependencySourceFiles || (removedDependencySourceFiles = new Set())).add(
					removedSourceFile,
				);
			}
		}

		return addedDependencies !== null ||
			removedDependencies !== null ||
			addedDependencySourceFiles !== null ||
			removedDependencySourceFiles !== null
			? {
					addedDependencies,
					removedDependencies,
					addedDependencySourceFiles,
					removedDependencySourceFiles,
			  }
			: null;
	}

	private findSourceFile(buildId: string, external = false): SourceFile | undefined {
		const sourceId = this.mapBuildIdToSourceId(buildId, external);
		const sourceFile = this.files.get(sourceId);
		if (sourceFile !== undefined && sourceFile.type !== 'source') {
			throw Error(
				`Expected 'source' file but found '${sourceFile.type}': ${sourceId} via buildId '${buildId}'`,
			);
		}
		return sourceFile;
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile || sourceFile.type !== 'source') return; // ignore build files (maybe throw an error if the file isn't found, should not happen)
		this.log.trace('destroying file', printPath(id));
		this.files.delete(id);
		if (sourceFile.buildable) {
			if (this.buildConfigs !== null) {
				await Promise.all(this.buildConfigs.map((b) => this.updateBuildFiles(sourceFile, [], b)));
			}
			await this.deleteCachedSourceInfo(sourceFile.id);
		}
	}

	// TODO track externals per build to match the flexibility of building local files
	// externalDependencies = new Set<string>();
	async addExternalDependency(id: string): Promise<BuildableExternalsSourceFile> {
		this.log.trace('add external dependency', id);
		if (this.externalsDir === null) {
			throw Error(`Expected an externalsDir to create an externals source file.`);
		}
		const shouldBuild = await this.updateSourceFile(id, this.externalsDir);
		const sourceFile = this.files.get(id);
		if (shouldBuild) {
			if (sourceFile === undefined || sourceFile.type !== 'source' || !sourceFile.buildable) {
				throw Error(`Expected to find externals source file: ${id}`);
			}
			if (this.externalsBuildConfig === null) {
				throw Error(`Expceted an externals build config to build source file: ${id}`);
			}
			// TODO remove this check
			if (
				sourceFile.buildConfigs.size !== 1 ||
				!sourceFile.buildConfigs.has(this.externalsBuildConfig!)
			) {
				throw Error(`TODO removeme - bad source file build configs`);
			}
			await this.buildSourceFile(sourceFile, this.externalsBuildConfig);
		}
		return sourceFile as BuildableExternalsSourceFile; // TODO check this instead?
	}
	// async removeExternalDependency(id: string): Promise<void> {
	// 	console.log('removeExternalDependency id (no-op? so we never clean them up?)', id);
	// 	// this.externalDependencies.add(id);
	// }

	// TODO as an optimization, this should be debounced per file,
	// because we're writing per build config.
	private async updateCachedSourceInfo(file: BuildableSourceFile): Promise<void> {
		if (file.buildConfigs.size === 0) return this.deleteCachedSourceInfo(file.id);
		const cacheId = toCachedSourceInfoId(file, this.buildRootDir, this.externalsDirBasePath);
		const data: CachedSourceInfoData = {
			sourceId: file.id,
			contentsHash: getFileContentsHash(file),
			builds: Array.from(file.buildFiles.values()).flatMap((files) =>
				files.map((file) => ({
					id: file.id,
					name: file.buildConfig.name,
					localDependencies: file.localDependencies && Array.from(file.localDependencies),
					externalDependencies: file.externalDependencies && Array.from(file.externalDependencies),
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
		// 		'wasted compilation detected! unchanged file was compiled and identical source info written to disk: ' +
		// 			cacheId,
		// 	);
		// }
		this.cachedSourceInfo.set(file.id, cachedSourceInfo);
		await outputFile(cacheId, JSON.stringify(data, null, 2));
	}

	private async deleteCachedSourceInfo(sourceId: string): Promise<void> {
		const info = this.cachedSourceInfo.get(sourceId);
		if (info === undefined) return; // silently do nothing, which is fine because it's a cache
		this.cachedSourceInfo.delete(sourceId);
		return remove(info.cacheId);
	}
}

// Given `newFiles` and `oldFiles`, updates everything on disk,
// deleting files that no longer exist, writing new ones, and updating existing ones.
const syncFilesToDisk = async (
	newFiles: readonly BuildFile[],
	oldFiles: readonly BuildFile[] | null,
	log: Logger,
): Promise<void> => {
	// This uses `Array#find` because the arrays are expected to be small,
	// because we're currently only using it for individual file compilations,
	// but that assumption might change and cause this code to be slow.
	await Promise.all([
		oldFiles === null
			? null
			: Promise.all(
					oldFiles.map((oldFile) => {
						if (!newFiles.find((f) => f.id === oldFile.id)) {
							log.trace('deleting build file on disk', printPath(oldFile.id));
							return remove(oldFile.id);
						}
						return undefined;
					}),
			  ),
		Promise.all(
			newFiles.map(async (newFile) => {
				const oldFile = oldFiles?.find((f) => f.id === newFile.id);
				let shouldOutputNewFile = false;
				if (!oldFile) {
					if (!(await pathExists(newFile.id))) {
						log.trace('creating build file on disk', printPath(newFile.id));
						shouldOutputNewFile = true;
					} else {
						const existingCotents = await loadContents(newFile.encoding, newFile.id);
						if (!areContentsEqual(newFile.encoding, newFile.contents, existingCotents)) {
							log.trace('updating stale build file on disk', printPath(newFile.id));
							shouldOutputNewFile = true;
						} // ...else the build file on disk already matches what's in memory.
						// This can happen if the source file changed but this particular build file did not.
						// Loading the usually-stale contents into memory to check before writing is inefficient,
						// but it avoids unnecessary writing to disk and misleadingly updated file stats.
					}
				} else if (!areContentsEqual(newFile.encoding, newFile.contents, oldFile.contents)) {
					log.trace('updating build file on disk', printPath(newFile.id));
					shouldOutputNewFile = true;
				} // ...else the build file on disk already matches what's in memory.
				// This can happen if the source file changed but this particular build file did not.
				if (shouldOutputNewFile) await outputFile(newFile.id, newFile.contents);
			}),
		),
	]);
};

const toCachedSourceInfoId = (
	file: BuildableSourceFile,
	buildRootDir: string,
	externalsDirBasePath: string,
): string => {
	const basePath =
		file.sourceType === 'externals'
			? `${externalsDirBasePath}/${file.dirBasePath}`
			: file.dirBasePath;
	return `${buildRootDir}${CACHED_SOURCE_INFO_DIR}/${basePath}${file.filename}${JSON_EXTENSION}`;
};

// Given `newFiles` and `oldFiles`, updates the memory cache,
// deleting files that no longer exist and setting the new ones, replacing any old ones.
const syncBuildFilesToMemoryCache = (
	files: Map<string, BaseFilerFile>,
	newFiles: readonly BuildFile[],
	oldFiles: readonly BuildFile[] | null,
	_log: Logger,
): void => {
	// Remove any deleted files.
	// This uses `Array#find` because the arrays are expected to be small,
	// because we're currently only using it for individual file compilations,
	// but that assumption might change and cause this code to be slow.
	if (oldFiles !== null) {
		for (const oldFile of oldFiles) {
			if (!newFiles.find((f) => f.id === oldFile.id)) {
				// log.trace('deleting file from memory', printPath(oldFile.id));
				files.delete(oldFile.id);
			}
		}
	}
	// Add or update any new or changed files.
	for (const newFile of newFiles) {
		// log.trace('setting file in memory cache', printPath(newFile.id));
		const oldFile = files.get(newFile.id) as BuildFile | undefined;
		if (oldFile !== undefined) {
			// This check ensures that if the user provides multiple source directories
			// the compiled output files do not conflict.
			// There may be a better design warranted, but for now the goal is to support
			// the flexibility of multiple source directories while avoiding surprising behavior.
			if (newFile.sourceFileId !== oldFile.sourceFileId) {
				throw Error(
					'Two source files are trying to compile to the same output location: ' +
						`${newFile.sourceFileId} & ${oldFile.sourceFileId}`,
				);
			}
		}
		files.set(newFile.id, newFile);
	}
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
// Some of these conditions like nested compiledDirs could be fixed
// but there are inefficiencies and possibly some subtle bugs.
const validateDirs = (
	compiledDirs: string[],
	externalsDir: string | null,
	buildRootDir: string,
) => {
	for (const compiledDir of compiledDirs) {
		const nestedCompiledDir = compiledDirs.find(
			(d) => d !== compiledDir && compiledDir.startsWith(d),
		);
		if (nestedCompiledDir) {
			throw Error(
				'A compiledDir cannot be inside another compiledDir: ' +
					`${compiledDir} is inside ${nestedCompiledDir}`,
			);
		}
		if (externalsDir !== null && compiledDir.startsWith(externalsDir)) {
			throw Error(
				'A compiledDir cannot be inside the externalsDir: ' +
					`${compiledDir} is inside ${externalsDir}`,
			);
		}
	}
	if (externalsDir !== null && !externalsDir.startsWith(buildRootDir)) {
		throw Error(
			'The externalsDir must be located inside the buildRootDir: ' +
				`${externalsDir} is not inside ${buildRootDir}`,
		);
	}
	const nestedCompiledDir =
		externalsDir !== null && compiledDirs.find((d) => externalsDir.startsWith(d));
	if (nestedCompiledDir) {
		throw Error(
			'The externalsDir cannot be inside a compiledDir: ' +
				`${externalsDir} is inside ${nestedCompiledDir}`,
		);
	}
};

// Creates objects to load a directory's contents and sync filesystem changes in memory.
// The order of objects in the returned array is meaningless.
const createFilerDirs = (
	compiledDirs: string[],
	servedDirs: ServedDir[],
	externalsDir: string | null,
	builder: Builder | null,
	buildRootDir: string,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	watcherDebounce: number | undefined,
): FilerDir[] => {
	const dirs: FilerDir[] = [];
	for (const compiledDir of compiledDirs) {
		dirs.push(createFilerDir(compiledDir, 'files', builder, onChange, watch, watcherDebounce));
	}
	if (externalsDir !== null) {
		dirs.push(createFilerDir(externalsDir, 'externals', builder, onChange, false, watcherDebounce));
	}
	for (const servedDir of servedDirs) {
		// If a `servedDir` is inside a compiled or externals directory,
		// it's already in the Filer's memory cache and does not need to be loaded as a directory.
		// Additionally, the same is true for `servedDir`s that are inside other `servedDir`s.
		if (
			!compiledDirs.find((d) => servedDir.dir.startsWith(d)) &&
			!(externalsDir !== null && servedDir.dir.startsWith(externalsDir)) &&
			!servedDirs.find((d) => d !== servedDir && servedDir.dir.startsWith(d.dir)) &&
			!servedDir.dir.startsWith(buildRootDir)
		) {
			dirs.push(createFilerDir(servedDir.dir, 'files', null, onChange, watch, watcherDebounce));
		}
	}
	return dirs;
};

const checkForConflictingExternalsDir = (
	servedDirs: readonly ServedDir[],
	externalsServedDir: ServedDir,
	externalsDirBasePath: string,
) =>
	Promise.all(
		servedDirs.map(async (servedDir) => {
			if (servedDir === externalsServedDir) return;
			if (await pathExists(`${servedDir.dir}/${externalsDirBasePath}`)) {
				throw Error(
					'A served directory contains a directory that conflicts with the externals directory.' +
						' One of them must be renamed to avoid import ambiguity.' +
						` ${servedDir.dir} contains "${externalsDirBasePath}"`,
				);
			}
		}),
	);

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
