import {resolve, extname, join, basename, dirname} from 'path';
import lexer from 'es-module-lexer';
import {createHash} from 'crypto';

import {
	FilerDir,
	FilerDirChangeCallback,
	createFilerDir,
	CompilableFilerDir,
	NonCompilableInternalsFilerDir,
	CompilableInternalsFilerDir,
	ExternalsFilerDir,
} from '../build/FilerDir.js';
import {
	findFiles,
	readFile,
	remove,
	outputFile,
	pathExists,
	readJson,
	stat,
	Stats,
} from '../fs/nodeFs.js';
import {
	EXTERNALS_BUILD_DIR,
	hasSourceExtension,
	isThisProjectGro,
	JSON_EXTENSION,
	JS_EXTENSION,
	paths,
	SOURCE_MAP_EXTENSION,
	toBuildOutPath,
} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta, red} from '../colors/terminal.js';
import {printError, printPath} from '../utils/print.js';
import type {Compiler} from '../compile/compiler.js';
import {getMimeTypeByExtension} from '../fs/mime.js';
import {Encoding, inferEncoding} from '../fs/encoding.js';
import {BuildConfig} from '../config/buildConfig.js';
import {stripEnd, stripStart} from '../utils/string.js';
import {postprocess} from './postprocess.js';
import {EcmaScriptTarget, DEFAULT_ECMA_SCRIPT_TARGET} from '../compile/tsHelpers.js';
import {ServedDir, ServedDirPartial, toServedDirs} from './ServedDir.js';

export type FilerFile = SourceFile | CompiledFile; // TODO or Directory? source/compiled directory?

export type SourceFile = CompilableSourceFile | NonCompilableSourceFile;
export type CompilableSourceFile =
	| CompilableTextSourceFile
	| CompilableBinarySourceFile
	| CompilableExternalsSourceFile;
export type NonCompilableSourceFile = NonCompilableTextSourceFile | NonCompilableBinarySourceFile;
export interface TextSourceFile extends BaseSourceFile {
	readonly sourceType: 'text';
	readonly encoding: 'utf8';
	readonly contents: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	readonly sourceType: 'binary';
	readonly encoding: null;
	readonly contents: Buffer;
	readonly contentsBuffer: Buffer;
}
export interface ExternalsSourceFile extends BaseSourceFile {
	readonly sourceType: 'externals';
	readonly encoding: 'utf8';
	readonly contents: string;
}
interface BaseSourceFile extends BaseFile {
	readonly type: 'source';
	readonly dirBasePath: string; // TODO is this the best design? if so should it also go on the `BaseFile`? what about `basePath` too?
}
export interface CompilableTextSourceFile extends TextSourceFile {
	readonly compilable: true;
	readonly filerDir: CompilableInternalsFilerDir;
	readonly compiledFiles: CompiledFile[];
	readonly buildConfigs: BuildConfig[];
}
export interface CompilableBinarySourceFile extends BinarySourceFile {
	readonly compilable: true;
	readonly filerDir: CompilableInternalsFilerDir;
	readonly compiledFiles: CompiledFile[];
	readonly buildConfigs: BuildConfig[];
}
export interface CompilableExternalsSourceFile extends ExternalsSourceFile {
	readonly compilable: true;
	readonly filerDir: ExternalsFilerDir;
	readonly compiledFiles: CompiledFile[];
	readonly buildConfigs: BuildConfig[];
}
export interface NonCompilableTextSourceFile extends TextSourceFile {
	readonly compilable: false;
	readonly filerDir: NonCompilableInternalsFilerDir;
	readonly compiledFiles: null;
	readonly buildConfigs: null;
}
export interface NonCompilableBinarySourceFile extends BinarySourceFile {
	readonly compilable: false;
	readonly filerDir: NonCompilableInternalsFilerDir;
	readonly compiledFiles: null;
	readonly buildConfigs: null;
}

export type CompiledFile = CompiledTextFile | CompiledBinaryFile;
export interface CompiledTextFile extends BaseCompiledFile {
	readonly encoding: 'utf8';
	readonly contents: string;
	readonly sourceMapOf: string | null; // TODO maybe prefer a union with an `isSourceMap` boolean flag?
}
export interface CompiledBinaryFile extends BaseCompiledFile {
	readonly encoding: null;
	readonly contents: Buffer;
	readonly contentsBuffer: Buffer;
}
interface BaseCompiledFile extends BaseFile {
	readonly type: 'compiled';
	readonly sourceFileId: string;
}

export interface BaseFile {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly encoding: Encoding;
	readonly contents: string | Buffer;
	contentsBuffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	contentsHash: string | undefined; // `undefined` and mutable for lazy loading
	stats: Stats | undefined; // `undefined` and mutable for lazy loading
	mimeType: string | null | undefined; // `null` means unknown, `undefined` and mutable for lazy loading
}

export interface CachedSourceInfo {
	sourceId: string;
	contentsHash: string;
	compilations: {id: string; encoding: Encoding}[];
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
		buildConfigs === null
			? null
			: buildConfigs.find((c) => c.platform === 'browser') ||
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
	async findByPath(path: string): Promise<BaseFile | null> {
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
		await Promise.all(this.dirs.map((dir) => dir.init())); // must be after `initCachedSourceInfo`

		const {buildConfigs} = this;
		if (this.cleanOutputDirs && buildConfigs !== null) {
			// Clean the dev output directories,
			// removing any files that can't be mapped back to source files.
			// For now, this does not handle production output.
			// See the comments where `dev` is declared for more.
			// (more accurately, it could handle prod, but not simultaneous to dev)
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
						filerDir.compilable &&
						// TODO this should probably be a generic flag on the `filerDir` like `lazyCompile`
						!(change.type === 'init' && filerDir.type === 'externals')
					) {
						await this.compileSourceId(id, filerDir);
					}
				}
				break;
			}
			case 'delete': {
				if (change.stats.isDirectory()) {
					if (this.buildConfigs !== null && filerDir.compilable) {
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
				this.buildConfigs,
				this.externalsBuildConfig,
			);
			// If the created source file has its compiled files hydrated,
			// we can infer that it doesn't need to be compiled.
			// TODO maybe make this more explicit with a `dirty` or `shouldCompile` flag?
			// Right now compilers always return at least one compiled file,
			// so it shouldn't be buggy, but it doesn't feel right.
			if (newSourceFile.compilable && newSourceFile.compiledFiles.length !== 0) {
				this.files.set(id, newSourceFile);
				syncCompiledFilesToMemoryCache(this.files, newSourceFile.compiledFiles, [], this.log);
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
		return filerDir.compilable;
	}

	// These are used to avoid concurrent compilations for any given source file.
	private pendingCompilations: Set<string> = new Set();
	private enqueuedCompilations: Map<string, [string, CompilableFilerDir]> = new Map();

	// This wrapper function protects against race conditions
	// that could occur with concurrent compilations.
	// If a file is currently being compiled, it enqueues the file id,
	// and when the current compilation finishes,
	// it removes the item from the queue and recompiles the file.
	// The queue stores at most one compilation per file,
	// and this is safe given that compiling accepts no parameters.
	private async compileSourceId(id: string, filerDir: CompilableFilerDir): Promise<void> {
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
		if (sourceFile.compilable === false) {
			throw Error(`Cannot compile a non-compilable source file: ${id}`);
		}

		// Compile the source file.
		// TODO support production builds
		// The Filer is designed to be able to be a long-lived process
		// that can output builds for both development and production,
		// but for now it's hardcoded to development, and production is entirely done by Rollup.
		const results = await Promise.all(
			sourceFile.buildConfigs.map((buildConfig) =>
				sourceFile.filerDir.compiler.compile(sourceFile, buildConfig, this),
			),
		);

		// Update the cache and write to disk.
		const newCompiledFiles = results.flatMap((result) =>
			result.compilations.map(
				(compilation): CompiledFile => {
					switch (compilation.encoding) {
						case 'utf8':
							return {
								type: 'compiled',
								sourceFileId: sourceFile.id,
								id: compilation.id,
								filename: compilation.filename,
								dir: compilation.dir,
								extension: compilation.extension,
								encoding: compilation.encoding,
								contents: postprocess(compilation, this, result, sourceFile),
								sourceMapOf: compilation.sourceMapOf,
								contentsBuffer: undefined,
								contentsHash: undefined,
								stats: undefined,
								mimeType: undefined,
							};
						case null:
							return {
								type: 'compiled',
								sourceFileId: sourceFile.id,
								id: compilation.id,
								filename: compilation.filename,
								dir: compilation.dir,
								extension: compilation.extension,
								encoding: compilation.encoding,
								contents: postprocess(compilation, this, result, sourceFile),
								contentsBuffer: compilation.contents,
								contentsHash: undefined,
								stats: undefined,
								mimeType: undefined,
							};
						default:
							throw new UnreachableError(compilation);
					}
				},
			),
		);
		const oldCompiledFiles = sourceFile.compiledFiles;
		const newSourceFile: CompilableSourceFile = {...sourceFile, compiledFiles: newCompiledFiles};
		this.files.set(id, newSourceFile);
		syncCompiledFilesToMemoryCache(this.files, newCompiledFiles, oldCompiledFiles, this.log);
		await Promise.all([
			syncFilesToDisk(newCompiledFiles, oldCompiledFiles, this.log),
			this.updateCachedSourceInfo(newSourceFile),
		]);
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile || sourceFile.type !== 'source') return; // ignore compiled files (maybe throw an error if the file isn't found, should not happen)
		this.log.trace('destroying file', printPath(id));
		this.files.delete(id);
		if (sourceFile.compilable) {
			syncCompiledFilesToMemoryCache(this.files, [], sourceFile.compiledFiles, this.log);
			await Promise.all([
				syncFilesToDisk([], sourceFile.compiledFiles, this.log),
				this.deleteCachedSourceInfo(sourceFile),
			]);
		}
	}

	private async updateCachedSourceInfo(file: CompilableSourceFile): Promise<void> {
		const cachedSourceInfoId = toCachedSourceInfoId(
			file,
			this.buildRootDir,
			this.externalsDirBasePath,
		);
		const cachedSourceInfo: CachedSourceInfo = {
			sourceId: file.id,
			// TODO what if we used mtime instead? possible errors?
			contentsHash: getFileContentsHash(file),
			compilations: file.compiledFiles.map((file) => ({id: file.id, encoding: file.encoding})),
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

	private deleteCachedSourceInfo(file: CompilableSourceFile): Promise<void> {
		this.cachedSourceInfo.delete(file.id);
		return remove(toCachedSourceInfoId(file, this.buildRootDir, this.externalsDirBasePath));
	}
}

// Given `newFiles` and `oldFiles`, updates everything on disk,
// deleting files that no longer exist, writing new ones, and updating existing ones.
const syncFilesToDisk = async (
	newFiles: CompiledFile[],
	oldFiles: CompiledFile[],
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
	file: CompilableSourceFile,
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
const syncCompiledFilesToMemoryCache = (
	files: Map<string, BaseFile>,
	newFiles: CompiledFile[],
	oldFiles: CompiledFile[],
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
		const oldFile = files.get(newFile.id) as CompiledFile | undefined;
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

export const getFileMimeType = (file: BaseFile): string | null =>
	file.mimeType !== undefined
		? file.mimeType
		: (file.mimeType = getMimeTypeByExtension(file.extension.substring(1)));

export const getFileContentsBuffer = (file: BaseFile): Buffer =>
	file.contentsBuffer !== undefined
		? file.contentsBuffer
		: (file.contentsBuffer = Buffer.from(file.contents));

// Stats are currently lazily loaded. Should they be?
export const getFileStats = (file: BaseFile): Stats | Promise<Stats> =>
	file.stats !== undefined
		? file.stats
		: stat(file.id).then((stats) => {
				file.stats = stats;
				return stats;
		  });

export const getFileContentsHash = (file: BaseFile): string =>
	file.contentsHash !== undefined
		? file.contentsHash
		: (file.contentsHash = toHash(getFileContentsBuffer(file)));

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
const toHash = (buf: Buffer): string => createHash('md5').update(buf).digest().toString('hex');

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

const loadContents = (encoding: Encoding, id: string): Promise<string | Buffer> =>
	encoding === null ? readFile(id) : readFile(id, encoding);

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

// This code could be shortened a lot by collapsing the object declarations,
// but as is it doesn't play nicely with the types, and it might be harder to reason about.
const createSourceFile = async (
	id: string,
	encoding: Encoding,
	extension: string,
	contents: string | Buffer,
	filerDir: FilerDir,
	cachedSourceInfo: CachedSourceInfo | undefined,
	buildConfigs: BuildConfig[] | null,
	externalsBuildConfig: BuildConfig | null,
): Promise<SourceFile> => {
	let contentsBuffer: Buffer | undefined = encoding === null ? (contents as Buffer) : undefined;
	let contentsHash: string | undefined = undefined;
	let compiledFiles: CompiledFile[] = [];
	if (filerDir.compilable && cachedSourceInfo !== undefined) {
		if (encoding === 'utf8') {
			contentsBuffer = Buffer.from(contents);
		} else if (encoding !== null) {
			throw new UnreachableError(encoding);
		}
		contentsHash = toHash(contentsBuffer!);
		if (contentsHash === cachedSourceInfo.contentsHash) {
			compiledFiles = await reconstructCompiledFiles(cachedSourceInfo);
		}
	}
	if (filerDir.type === 'externals') {
		if (encoding !== 'utf8') {
			throw Error(`Externals sources must have utf8 encoding, not '${encoding}': ${id}`);
		}
		let filename = basename(id) + (id.endsWith(extension) ? '' : extension);
		const dir = `${filerDir.dir}/${dirname(id)}/`; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
		const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
		return {
			type: 'source',
			sourceType: 'externals',
			compilable: true,
			buildConfigs: [externalsBuildConfig!],
			id,
			filename,
			dir,
			dirBasePath,
			extension,
			encoding,
			contents: contents as string,
			contentsBuffer,
			contentsHash,
			filerDir,
			compiledFiles,
			stats: undefined,
			mimeType: undefined,
		};
	}
	const filename = basename(id);
	const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
	const dirBasePath = stripStart(dir, filerDir.dir + '/'); // TODO see above comment about `+ '/'`
	switch (encoding) {
		case 'utf8':
			return filerDir.compilable
				? {
						type: 'source',
						sourceType: 'text',
						buildConfigs: buildConfigs!.filter(
							(buildConfig) => buildConfig.include === null || buildConfig.include(id),
						),
						compilable: true,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: contents as string,
						contentsBuffer,
						contentsHash,
						filerDir,
						compiledFiles,
						stats: undefined,
						mimeType: undefined,
				  }
				: {
						type: 'source',
						sourceType: 'text',
						buildConfigs: null,
						compilable: false,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: contents as string,
						contentsBuffer,
						contentsHash,
						filerDir,
						compiledFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		case null:
			return filerDir.compilable
				? {
						type: 'source',
						sourceType: 'binary',
						buildConfigs: buildConfigs!.filter(
							(buildConfig) => buildConfig.include === null || buildConfig.include(id),
						),
						compilable: true,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: contents as Buffer,
						contentsBuffer: contentsBuffer as Buffer,
						contentsHash,
						filerDir,
						compiledFiles,
						stats: undefined,
						mimeType: undefined,
				  }
				: {
						type: 'source',
						sourceType: 'binary',
						buildConfigs: null,
						compilable: false,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: contents as Buffer,
						contentsBuffer: contentsBuffer as Buffer,
						contentsHash,
						filerDir,
						compiledFiles: null,
						stats: undefined,
						mimeType: undefined,
				  };
		default:
			throw new UnreachableError(encoding);
	}
};

const reconstructCompiledFiles = (cachedSourceInfo: CachedSourceInfo): Promise<CompiledFile[]> =>
	Promise.all(
		cachedSourceInfo.compilations.map(
			async (compilation): Promise<CompiledFile> => {
				const {id} = compilation;
				const filename = basename(id);
				const dir = dirname(id) + '/'; // TODO the slash is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
				const extension = extname(id);
				const contents = await loadContents(compilation.encoding, id);
				switch (compilation.encoding) {
					case 'utf8':
						return {
							type: 'compiled',
							sourceFileId: cachedSourceInfo.sourceId,
							id,
							filename,
							dir,
							extension,
							encoding: compilation.encoding,
							contents: contents as string,
							sourceMapOf: id.endsWith(SOURCE_MAP_EXTENSION)
								? stripEnd(id, SOURCE_MAP_EXTENSION)
								: null,
							contentsBuffer: undefined,
							contentsHash: undefined,
							stats: undefined,
							mimeType: undefined,
						};
					case null:
						return {
							type: 'compiled',
							sourceFileId: cachedSourceInfo.sourceId,
							id,
							filename,
							dir,
							extension,
							encoding: compilation.encoding,
							contents: contents as Buffer,
							contentsBuffer: contents as Buffer,
							contentsHash: undefined,
							stats: undefined,
							mimeType: undefined,
						};
					default:
						throw new UnreachableError(compilation.encoding);
				}
			},
		),
	);

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
