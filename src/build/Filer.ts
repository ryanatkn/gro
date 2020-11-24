import {resolve, extname, join} from 'path';
import lexer from 'es-module-lexer';

import {
	FilerDir,
	FilerDirChangeCallback,
	createFilerDir,
	BuildableFilerDir,
	ExternalsFilerDir,
} from '../build/FilerDir.js';
import {findFiles, remove, outputFile, pathExists, readJson} from '../fs/nodeFs.js';
import {
	basePathToSourceId,
	EXTERNALS_BUILD_DIR,
	hasSourceExtension,
	isThisProjectGro,
	JSON_EXTENSION,
	JS_EXTENSION,
	paths,
	toBuildBasePath,
	toBuildOutPath,
	toSourceExtension,
} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta, red} from '../colors/terminal.js';
import {printError, printPath} from '../utils/print.js';
import type {Compiler} from '../compile/compiler.js';
import {Encoding, inferEncoding} from '../fs/encoding.js';
import {BuildConfig} from '../config/buildConfig.js';
import {stripEnd, stripStart} from '../utils/string.js';
import {EcmaScriptTarget, DEFAULT_ECMA_SCRIPT_TARGET} from '../compile/tsHelpers.js';
import {ServedDir, ServedDirPartial, toServedDirs} from './ServedDir.js';
import {BuildableSourceFile, createSourceFile, SourceFile} from './sourceFile.js';
import {BuildFile, createBuildFile} from './buildFile.js';
import {BaseFilerFile, getFileContentsHash} from './baseFilerFile.js';
import {loadContents} from './load.js';

export type FilerFile = SourceFile | BuildFile; // TODO or Directory? source/compiled directory?

export interface CachedSourceInfo {
	sourceId: string;
	contentsHash: string;
	compilations: {id: string; encoding: Encoding; locals: string[]; externals: string[]}[];
}
const CACHED_SOURCE_INFO_DIR = 'cachedSourceInfo';

export interface Options {
	dev: boolean;
	compiler: Compiler | null;
	compiledDirs: string[];
	externalsDir: string | null;
	servedDirs: ServedDir[];
	buildConfigs: BuildConfig[] | null;
	externalsBuildConfig: BuildConfig | null;
	buildRootDir: string;
	mapBuildIdToSourceId: typeof defaultMapBuildIdToSourceId;
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
							(buildConfigs.find((c) => c.platform === 'browser') || buildConfigs[0]).name,
							'',
							buildRootDir,
						) + (isThisProjectGro ? '/frontend' : ''), // TODO hacky, remove when `gro.config.ts` is added
				  ]),
		externalsDir,
		buildRootDir,
	);
	if (compiledDirCount === 0 && servedDirs.length === 0) {
		throw Error('Filer created with no directories to compile or serve.');
	}
	if (compiledDirCount !== 0 && buildConfigs === null) {
		throw Error('Filer created with directories to compile but no build configs were provided.');
	}
	const compiler = opts.compiler || null;
	if (compiledDirCount !== 0 && !compiler) {
		throw Error('Filer created with directories to compile but no compiler was provided.');
	}
	if (compiler && compiledDirCount === 0) {
		throw Error('Filer created with a compiler but no directories to compile.');
	}
	return {
		dev,
		mapBuildIdToSourceId: defaultMapBuildIdToSourceId,
		sourceMap: true,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		watch: true,
		watcherDebounce: undefined,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger([magenta('[filer]')]),
		compiler,
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
	private readonly mapBuildIdToSourceId: typeof defaultMapBuildIdToSourceId;
	private readonly cleanOutputDirs: boolean;
	private readonly log: Logger;

	// public properties available to e.g. compilers and postprocessors
	readonly buildRootDir: string;
	readonly dev: boolean;
	readonly sourceMap: boolean;
	readonly target: EcmaScriptTarget;
	readonly externalsDirBasePath: string | null;
	readonly servedDirs: readonly ServedDir[];

	constructor(opts: InitialOptions) {
		const {
			dev,
			compiler,
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
			compiler,
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
				? null
				: stripStart(this.externalsDir.dir, `${this.externalsServedDir.servedAt}/`);
	}

	// Searches for a file matching `path`, limited to the directories that are served.
	async findByPath(path: string): Promise<BaseFilerFile | null> {
		const {externalsDirBasePath, externalsServedDir, files} = this;
		// TODO probably want to generalize this with "lazy" and/or "dirty" flags on compiledDirs
		if (externalsDirBasePath !== null && path.startsWith(externalsDirBasePath)) {
			const id = `${externalsServedDir!.servedAt}/${path}`;
			const file = files.get(id);
			if (file !== undefined) {
				return file;
			}
			const sourceId = stripEnd(stripStart(path, `${externalsDirBasePath}/`), JS_EXTENSION);
			const shouldCompile = await this.updateSourceFile(sourceId, this.externalsDir!);
			if (shouldCompile) {
				await this.compileSourceId(sourceId, this.externalsDir!);
			}
			const compiledFile = files.get(id);
			if (compiledFile === undefined) {
				throw Error('Expected to compile file');
			}
			return compiledFile;
		} else {
			for (const servedDir of this.servedDirs) {
				if (servedDir === externalsServedDir) continue;
				const id = `${servedDir.servedAt}/${path}`;
				const file = files.get(id);
				if (file !== undefined) {
					return file;
				}
			}
		}
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
		let finishInitializing: () => void;
		this.initializing = new Promise((r) => (finishInitializing = r));

		await Promise.all([this.initCachedSourceInfo(), lexer.init]);
		// Initializing the dirs must be done after `this.initCachedSourceInfo`
		// because it creates source files, which need `this.cachedSourceInfo` to be populated.
		await Promise.all(this.dirs.map((dir) => dir.init()));
		// This performs initial source file compilation, traces deps,
		// and populates the `buildConfigs` property of all source files.
		await this.initBuildConfigs();
		console.log('buildConfigs', this.buildConfigs);

		// TODO this needs to perform matching for each buildConfig against the file,
		// right now it just checks if the file exists at all, not specifically for that buildConfig
		if ((globalThis as any).THIS_IS_TEMPORARILY_DISABLED_SEE_ABOVE) {
			const {buildConfigs} = this;
			if (this.cleanOutputDirs && buildConfigs !== null) {
				// Clean the dev output directories,
				// removing any files that can't be mapped back to source files.
				const buildOutDirs: string[] = buildConfigs.map((buildConfig) =>
					toBuildOutPath(this.dev, buildConfig.name, '', this.buildRootDir),
				);
				await Promise.all(
					buildOutDirs.map(async (outputDir) => {
						if (!(await pathExists(outputDir))) return;
						const files = await findFiles(outputDir, undefined, null);
						await Promise.all(
							Array.from(files.entries()).map(([path, stats]) => {
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
								this.log.trace('deleting unknown compiled file', printPath(id));
								return remove(id);
							}),
						);
					}),
				);
			}
		}

		// Ensure that the externals directory does not conflict with another served directory.
		// This check must wait until the above syncing completes.
		// TODO we need to delete unknown dirs in the build directory above, not just files,
		// otherwise this error does not get cleared if you delete the conflicting directory
		if (this.externalsServedDir !== null && this.externalsDirBasePath !== null) {
			await checkForConflictingExternalsDir(
				this.servedDirs,
				this.externalsServedDir,
				this.externalsDirBasePath,
			);
		}

		finishInitializing!();
	}

	private async initCachedSourceInfo(): Promise<void> {
		const cachedSourceInfoDir = `${this.buildRootDir}${CACHED_SOURCE_INFO_DIR}`;
		if (!(await pathExists(cachedSourceInfoDir))) return;
		const files = await findFiles(cachedSourceInfoDir, undefined, null);
		await Promise.all(
			Array.from(files.entries()).map(async ([path, stats]) => {
				if (stats.isDirectory()) return;
				const info: CachedSourceInfo = await readJson(`${cachedSourceInfoDir}/${path}`);
				this.cachedSourceInfo.set(info.sourceId, info);
			}),
		);
	}

	// During initialization, after all files are loaded into memory,
	// this is called to populate the `buildConfigs` property of all source files.
	// It performs the initial compilation to be able to determine output dependencies.
	initialCompiledSourceIds = new Set<string>();
	private async initBuildConfigs(): Promise<void> {
		this.externalsBuildConfig; // TODO REMOVE ME THIS IS JUST FOR TYPES
		filterBuildConfigs; // TODO REMOVE ME THIS IS JUST FOR TYPES
		if (this.buildConfigs === null) return;
		const sourceFilesToCompile = new Set<BuildableSourceFile>();
		for (const buildConfig of this.buildConfigs) {
			// This traces the dependencies starting from each buildConfig input.
			// It compiles each input source file and populates its `buildConfigs`,
			// recursively until all dependencies have been handled.
			buildConfig.input.map((buildConfigInput) => {
				// TODO handle dirs and patterns
				const sourceFile = this.files.get(buildConfigInput);
				if (!sourceFile) throw Error('TODO do we need this check?');
				if (sourceFile.type !== 'source') throw Error('TODO needed?');
				if (!sourceFile.buildable) throw Error('TODO needed?');
				sourceFile.buildConfigs.push(buildConfig);
				sourceFilesToCompile.add(sourceFile);
			});
		}
		// TODO track externals per build to match the flexibility of building local files
		const externalDependencies = new Set<string>();
		const localDependencies = new Set<string>(); // TODO or `initialCompiledSourceIds`?
		await Promise.all(
			Array.from(sourceFilesToCompile).map(async (sourceFile) => {
				this.initialCompiledSourceIds.add(sourceFile.id);
				await this.compileSourceId(sourceFile.id, sourceFile.filerDir);
				// At this point, we need to compile the deps of the compiled files.
				// Then, each of those needs to compile its deps, and so forth.
				// TODO we need to look up the source files again, because they're NOT mutated.
				// Maybe source files should be mutated as an optimization? hmm
				const updatedSourceFile = this.files.get(sourceFile.id) as BuildableSourceFile;
				await Promise.all(
					updatedSourceFile.compiledFiles.map((compiledFile) => {
						console.log('\n\ncompiledFile.id', compiledFile.id);
						for (const externalDependency of compiledFile.externals) {
							externalDependencies.add(externalDependency);
						}
						// TODO wait so we need to map the imported dependencies back from the compiled files to the source files? hmm
						// do we expect these to always be relative paths, so we need to resolve them against the compiled file dir?
						for (const localDependency of compiledFile.locals) {
							// TODO this should short circuit if the source has already been added to the input set
							const dependencyId = join(compiledFile.dir, localDependency);
							console.log('dependencyId', dependencyId);
							const dependencySourceId = this.mapBuildIdToSourceId(dependencyId);
							console.log('dependencySourceId', dependencySourceId);
							const dependencySourceFile = this.files.get(dependencySourceId);
							if (!dependencySourceFile) {
								// TODO remove this check
								throw Error(`CHECKING unable to find dependencySourceId: ${dependencySourceId}`);
							}
							// this.compileBuildFile(dependencySourceFile);
							// this.compileDependency(dependencySourceFile);
						}
					}),
				);
			}),
		);
		console.log('externals', externalDependencies);
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
					const shouldCompile = await this.updateSourceFile(id, filerDir);
					if (
						shouldCompile &&
						// When initializing, compilation is deferred to `initBuildConfigs`
						// so that deps are determined in the correct order.
						change.type !== 'init' &&
						filerDir.buildable // only needed for types, doing this instead of casting for type safety
					) {
						await this.compileSourceId(id, filerDir);
					}
				}
				break;
			}
			case 'delete': {
				if (change.stats.isDirectory()) {
					if (this.buildConfigs !== null && filerDir.buildable) {
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

		let newSourceFile: SourceFile;
		if (sourceFile === undefined) {
			// Memory cache is cold.
			newSourceFile = await createSourceFile(
				id,
				encoding,
				extension,
				newSourceContents,
				filerDir,
				this.cachedSourceInfo.get(id),
			);
			// If the created source file has its compiled files hydrated,
			// we can infer that it doesn't need to be compiled.
			// TODO maybe make this more explicit with a `dirty` or `shouldCompile` flag?
			// Right now compilers always return at least one compiled file,
			// so it shouldn't be buggy, but it doesn't feel right.
			if (newSourceFile.buildable && newSourceFile.compiledFiles.length !== 0) {
				this.files.set(id, newSourceFile);
				syncBuildFilesToMemoryCache(this.files, newSourceFile.compiledFiles, [], this.log);
				return false;
			}
		} else if (
			areContentsEqual(encoding, sourceFile.contents, newSourceContents) &&
			// TODO hack to avoid the comparison for externals because they're compiled lazily
			!(sourceFile.sourceType === 'externals' && sourceFile.compiledFiles.length === 0)
		) {
			// Memory cache is warm and source code hasn't changed, do nothing and exit early!
			return false;
		} else {
			// Memory cache is warm, but contents have changed.
			switch (sourceFile.encoding) {
				case 'utf8':
					newSourceFile = {
						...sourceFile,
						contents: newSourceContents as string,
						stats: undefined,
						contentsBuffer: undefined,
						contentsHash: undefined,
					};
					break;
				case null:
					newSourceFile = {
						...sourceFile,
						contents: newSourceContents as Buffer,
						stats: undefined,
						contentsBuffer: newSourceContents as Buffer,
						contentsHash: undefined,
					};
					break;
				default:
					throw new UnreachableError(sourceFile);
			}
		}
		this.files.set(id, newSourceFile);
		return filerDir.buildable;
	}

	// These are used to avoid concurrent compilations for any given source file.
	private pendingCompilations: Set<string> = new Set();
	private enqueuedCompilations: Map<string, [string, BuildableFilerDir]> = new Map();

	// This wrapper function protects against race conditions
	// that could occur with concurrent compilations.
	// If a file is currently being compiled, it enqueues the file id,
	// and when the current compilation finishes,
	// it removes the item from the queue and recompiles the file.
	// The queue stores at most one compilation per file,
	// and this is safe given that compiling accepts no parameters.
	private async compileSourceId(id: string, filerDir: BuildableFilerDir): Promise<void> {
		if (this.pendingCompilations.has(id)) {
			this.enqueuedCompilations.set(id, [id, filerDir]);
			return;
		}
		this.pendingCompilations.add(id);
		try {
			await this._compileSourceId(id);
		} catch (err) {
			this.log.error(red('failed to compile'), printPath(id), printError(err));
		}
		this.pendingCompilations.delete(id);
		const enqueuedCompilation = this.enqueuedCompilations.get(id);
		if (enqueuedCompilation !== undefined) {
			this.enqueuedCompilations.delete(id);
			// Something changed during the compilation for this file, so recurse.
			// TODO do we need to detect cycles? if we run into any, probably
			const shouldCompile = await this.updateSourceFile(...enqueuedCompilation);
			if (shouldCompile) {
				await this.compileSourceId(...enqueuedCompilation);
			}
		}
	}

	private async _compileSourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile) {
			throw Error(`Cannot find source file: ${id}`);
		}
		if (sourceFile.type !== 'source') {
			throw Error(`Cannot compile file with type '${sourceFile.type}': ${id}`);
		}
		if (sourceFile.buildable === false) {
			throw Error(`Cannot compile a non-buildable source file: ${id}`);
		}

		// Compile the source file.
		// The Filer is designed to be able to be a long-lived process
		// that can output builds for both development and production,
		// but for now it's hardcoded to development, and production is entirely done by Rollup.
		const results = await Promise.all(
			sourceFile.buildConfigs.map((buildConfig) =>
				sourceFile.filerDir.compiler.compile(sourceFile, buildConfig, this),
			),
		);

		// Update the cache and write to disk.

		// Postprocess should probably return the whole compilation, or just mutate it,
		// OR the entire result with all of its compilations,
		// adding the deps in a single lexer pass.
		// Be sure to handle hydrated compiled files without wasted compiles to get the deps!
		// Does that mean we need to store dependencies in the cachedSourceInfo compilations?
		//
		// Also should we extract a helper, `createBuildFiles`, or something?
		const newBuildFiles = results.flatMap((result) =>
			result.compilations.map((compilation) =>
				createBuildFile(compilation, this, result, sourceFile),
			),
		);
		const oldBuildFiles = sourceFile.compiledFiles;
		const newSourceFile: BuildableSourceFile = {...sourceFile, compiledFiles: newBuildFiles};
		this.files.set(id, newSourceFile);
		syncBuildFilesToMemoryCache(this.files, newBuildFiles, oldBuildFiles, this.log);
		await Promise.all([
			syncFilesToDisk(newBuildFiles, oldBuildFiles, this.log),
			this.updateCachedSourceInfo(newSourceFile),
		]);
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile || sourceFile.type !== 'source') return; // ignore compiled files (maybe throw an error if the file isn't found, should not happen)
		this.log.trace('destroying file', printPath(id));
		this.files.delete(id);
		if (sourceFile.buildable) {
			syncBuildFilesToMemoryCache(this.files, [], sourceFile.compiledFiles, this.log);
			await Promise.all([
				syncFilesToDisk([], sourceFile.compiledFiles, this.log),
				this.deleteCachedSourceInfo(sourceFile),
			]);
		}
	}

	private async updateCachedSourceInfo(file: BuildableSourceFile): Promise<void> {
		const cachedSourceInfoId = toCachedSourceInfoId(
			file,
			this.buildRootDir,
			this.externalsDirBasePath,
		);
		const cachedSourceInfo: CachedSourceInfo = {
			sourceId: file.id,
			contentsHash: getFileContentsHash(file),
			compilations: file.compiledFiles.map((file) => ({
				id: file.id,
				encoding: file.encoding,
				locals: file.locals,
				externals: file.externals,
			})),
		};
		// This is useful for debugging, but has false positives
		// when source changes but output doesn't, like if comments get elided.
		// if (
		// 	(await pathExists(cachedSourceInfoId)) &&
		// 	deepEqual(await readJson(cachedSourceInfoId), cachedSourceInfo)
		// ) {
		// 	console.log(
		// 		'wasted compilation detected! unchanged file was compiled and identical source info written to disk: ' +
		// 			cachedSourceInfoId,
		// 	);
		// }
		this.cachedSourceInfo.set(file.id, cachedSourceInfo);
		await outputFile(cachedSourceInfoId, JSON.stringify(cachedSourceInfo, null, 2));
	}

	private deleteCachedSourceInfo(file: BuildableSourceFile): Promise<void> {
		this.cachedSourceInfo.delete(file.id);
		return remove(toCachedSourceInfoId(file, this.buildRootDir, this.externalsDirBasePath));
	}
}

// Given `newFiles` and `oldFiles`, updates everything on disk,
// deleting files that no longer exist, writing new ones, and updating existing ones.
const syncFilesToDisk = async (
	newFiles: BuildFile[],
	oldFiles: BuildFile[],
	log: Logger,
): Promise<void> => {
	// This uses `Array#find` because the arrays are expected to be small,
	// because we're currently only using it for individual file compilations,
	// but that assumption might change and cause this code to be slow.
	await Promise.all([
		Promise.all(
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
				const oldFile = oldFiles.find((f) => f.id === newFile.id);
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
						// This can happen if the source file changed but this particular compiled file did not.
						// Loading the usually-stale contents into memory to check before writing is inefficient,
						// but it avoids unnecessary writing to disk and misleadingly updated file stats.
					}
				} else if (!areContentsEqual(newFile.encoding, newFile.contents, oldFile.contents)) {
					log.trace('updating build file on disk', printPath(newFile.id));
					shouldOutputNewFile = true;
				} // ...else the build file on disk already matches what's in memory.
				// This can happen if the source file changed but this particular compiled file did not.
				if (shouldOutputNewFile) await outputFile(newFile.id, newFile.contents);
			}),
		),
	]);
};

const toCachedSourceInfoId = (
	file: BuildableSourceFile,
	buildRootDir: string,
	externalsDirBasePath: string | null,
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
	newFiles: BuildFile[],
	oldFiles: BuildFile[],
	_log: Logger,
): void => {
	// This uses `Array#find` because the arrays are expected to be small,
	// because we're currently only using it for individual file compilations,
	// but that assumption might change and cause this code to be slow.
	for (const oldFile of oldFiles) {
		if (!newFiles.find((f) => f.id === oldFile.id)) {
			// log.trace('deleting file from memory', printPath(oldFile.id));
			files.delete(oldFile.id);
		}
	}
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

const filterBuildConfigs = (buildConfigs: BuildConfig[], id: string): BuildConfig[] => {
	const filtered = buildConfigs.filter(
		(buildConfig) =>
			// TODO this fails to match transitive dependencies
			matchesInput(buildConfig.input, id) &&
			(buildConfig.include === null || buildConfig.include(id)), // TODO should we remove `include` altogether?
	);
	if (filtered.length) {
		console.log('id', id, filtered);
	} else {
		console.log('no', id);
	}
	return filtered;
};

const matchesInput = (input: BuildConfig['input'], id: string): boolean => {
	// TODO this is bugged for dirs because we're not adding a trailing slash
	// it's also bugged for files because it needs to exactly match the string in that case.
	// should `input` be a union type of file/dir/filter?
	return input.some((i) => id.startsWith(i));
};

// Creates objects to load a directory's contents and sync filesystem changes in memory.
// The order of objects in the returned array is meaningless.
const createFilerDirs = (
	compiledDirs: string[],
	servedDirs: ServedDir[],
	externalsDir: string | null,
	compiler: Compiler | null,
	buildRootDir: string,
	onChange: FilerDirChangeCallback,
	watch: boolean,
	watcherDebounce: number | undefined,
): FilerDir[] => {
	const dirs: FilerDir[] = [];
	for (const compiledDir of compiledDirs) {
		dirs.push(createFilerDir(compiledDir, 'files', compiler, onChange, watch, watcherDebounce));
	}
	if (externalsDir !== null) {
		dirs.push(
			createFilerDir(externalsDir, 'externals', compiler, onChange, false, watcherDebounce),
		);
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

const defaultMapBuildIdToSourceId = (buildId: string): string =>
	basePathToSourceId(toSourceExtension(toBuildBasePath(buildId)));
