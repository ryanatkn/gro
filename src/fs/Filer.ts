import {resolve, extname, join, basename, dirname} from 'path';
import lexer from 'es-module-lexer';

import {ensureDir, stat, Stats} from './nodeFs.js';
import {watchNodeFs, DEBOUNCE_DEFAULT, WatcherChange} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {hasSourceExtension, JS_EXTENSION, SVELTE_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {findFiles, readFile, remove, outputFile, pathExists} from '../fs/nodeFs.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta, red} from '../colors/terminal.js';
import {printError, printPath} from '../utils/print.js';
import type {
	Compiler,
	TextCompilation,
	BinaryCompilation,
	Compilation,
} from '../compile/compiler.js';
import {getMimeTypeByExtension} from './mime.js';
import {Encoding, inferEncoding} from './encoding.js';
import {replaceExtension} from '../utils/path.js';
import {stripStart} from '../utils/string.js';
import {BuildConfig} from '../project/buildConfig.js';

export type FilerFile = SourceFile | CompiledFile; // TODO or Directory? source/compiled directory?

export type SourceFile = CompilableSourceFile | NonCompilableSourceFile;
export type CompilableSourceFile = CompilableTextSourceFile | CompilableBinarySourceFile;
export type NonCompilableSourceFile = NonCompilableTextSourceFile | NonCompilableBinarySourceFile;
export interface TextSourceFile extends BaseSourceFile {
	readonly encoding: 'utf8';
	readonly contents: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	readonly encoding: null;
	readonly contents: Buffer;
	readonly buffer: Buffer;
}
interface BaseSourceFile extends BaseFile {
	readonly type: 'source';
}
export interface CompilableTextSourceFile extends TextSourceFile {
	readonly watchedDir: CompilableWatchedDir;
	readonly compiledFiles: CompiledFile[];
	readonly outDir: string;
}
export interface CompilableBinarySourceFile extends BinarySourceFile {
	readonly watchedDir: CompilableWatchedDir;
	readonly compiledFiles: CompiledFile[];
	readonly outDir: string;
}
export interface NonCompilableTextSourceFile extends TextSourceFile {
	readonly watchedDir: NonCompilableWatchedDir;
	readonly compiledFiles: null;
	readonly outDir: null;
}
export interface NonCompilableBinarySourceFile extends BinarySourceFile {
	readonly watchedDir: NonCompilableWatchedDir;
	readonly compiledFiles: null;
	readonly outDir: null;
}

export type CompiledFile = CompiledTextFile | CompiledBinaryFile;
export interface CompiledTextFile extends BaseCompiledFile {
	readonly compilation: TextCompilation;
	readonly encoding: 'utf8';
	readonly contents: string;
	readonly sourceMapOf: string | null; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
}
export interface CompiledBinaryFile extends BaseCompiledFile {
	readonly compilation: BinaryCompilation;
	readonly encoding: null;
	readonly contents: Buffer;
	readonly buffer: Buffer;
}
interface BaseCompiledFile extends BaseFile {
	readonly type: 'compiled';
	readonly sourceFile: CompilableSourceFile;
}

export interface BaseFile {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly encoding: Encoding;
	readonly contents: string | Buffer;
	buffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	stats: Stats | undefined; // `undefined` and mutable for lazy loading
	mimeType: string | null | undefined; // `null` means unknown, `undefined` and mutable for lazy loading
}

export interface CompiledDir {
	// TODO should this include the compiler? any other options?
	// or do we specifically isolate everything else into a single bundle of things?
	// what if the external compiler changes between runs, but the internal options and source file hash don't,
	// so we get a false negative that re-compilation is needed once source hash caching is implemented?
	readonly sourceDir: string;
	readonly outDir: string;
}

export interface Options {
	compiler: Compiler | null;
	buildConfigs: BuildConfig[] | null;
	include: (id: string) => boolean;
	compiledDirs: CompiledDir[];
	servedDirs: string[];
	sourceMap: boolean;
	debounce: number;
	watch: boolean;
	cleanOutputDirs: boolean;
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const compiledDirs = opts.compiledDirs
		? opts.compiledDirs.map((d) => ({sourceDir: resolve(d.sourceDir), outDir: resolve(d.outDir)}))
		: [];
	validateCompiledDirs(compiledDirs);
	// default to serving all of the compiled output files
	const servedDirs = Array.from(
		new Set((opts.servedDirs || compiledDirs.map((d) => d.outDir)).map((d) => resolve(d))),
	);
	if (!compiledDirs.length && !servedDirs.length) {
		throw Error('Filer created with no directories to compile or serve.');
	}
	const compiler = opts.compiler || null;
	if (compiledDirs.length && !compiler) {
		throw Error('Filer created with directories to compile but no compiler was provided.');
	}
	if (compiler && !compiledDirs.length) {
		throw Error('Filer created with a compiler but no directories to compile.');
	}
	return {
		buildConfigs: null,
		sourceMap: true,
		debounce: DEBOUNCE_DEFAULT,
		watch: true,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		include: opts.include || (() => true),
		log: opts.log || new SystemLogger([magenta('[filer]')]),
		compiledDirs,
		servedDirs,
		compiler,
	};
};

export class Filer {
	private readonly compiler: Compiler | null;
	private readonly sourceMap: boolean;
	private readonly cleanOutputDirs: boolean;
	private readonly log: Logger;
	private readonly dirs: WatchedDir[];
	private readonly servedDirs: string[];
	private readonly buildConfigs: BuildConfig[] | null;
	private readonly include: (id: string) => boolean;

	private readonly files: Map<string, FilerFile> = new Map();

	constructor(opts: InitialOptions) {
		const {
			compiler,
			include,
			sourceMap,
			compiledDirs,
			servedDirs,
			buildConfigs,
			debounce,
			watch,
			cleanOutputDirs,
			log,
		} = initOptions(opts);
		this.compiler = compiler;
		this.include = include;
		this.sourceMap = sourceMap;
		this.cleanOutputDirs = cleanOutputDirs;
		this.log = log;
		this.dirs = createWatchedDirs(
			compiledDirs,
			servedDirs,
			watch,
			debounce,
			this.onWatchedDirChange,
		);
		this.servedDirs = servedDirs;
		this.buildConfigs = buildConfigs;
	}

	// Searches for a file matching `path`, limited to the directories that are served.
	findByPath(path: string): BaseFile | null {
		for (const servedDir of this.servedDirs) {
			const id = join(servedDir, path);
			const file = this.files.get(id);
			if (file) return file;
		}
		return null;
	}

	destroy(): void {
		for (const dir of this.dirs) {
			dir.destroy();
		}
	}

	private initializing: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.initializing) return this.initializing;
		let finishInitializing: () => void;
		this.initializing = new Promise((r) => (finishInitializing = r));

		await Promise.all([Promise.all(this.dirs.map((d) => d.init())), lexer.init]);

		const {buildConfigs} = this;
		if (this.cleanOutputDirs && buildConfigs !== null) {
			// Clean the output directories, removing any files that can't be mapped back to source files.
			const outputDirs: string[] = this.dirs
				.map((d) => d.outDir!)
				.filter(Boolean)
				.flatMap((d) => buildConfigs.map((p) => join(d, p.name)));
			await Promise.all(
				outputDirs.map(async (outputDir) => {
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

		finishInitializing!();
	}

	private onWatchedDirChange: WatchedDirChangeCallback = async (
		change: WatcherChange,
		watchedDir: WatchedDir,
	) => {
		const id = join(watchedDir.dir, change.path);
		switch (change.type) {
			case 'create':
			case 'update': {
				if (change.stats.isDirectory()) {
					// We could ensure the directory, but it's usually wasted work,
					// and `fs-extra` takes care of adding missing directories when writing to disk.
				} else {
					if (await this.updateSourceFile(id, watchedDir)) {
						await this.compileSourceId(id, watchedDir);
					}
				}
				break;
			}
			case 'delete': {
				if (change.stats.isDirectory()) {
					if (watchedDir.outDir !== null) {
						// Although we don't pre-emptively create build directories above, we do delete them.
						await remove(join(watchedDir.outDir, change.path));
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

	// Returns a boolean indicating if the source file changed.
	private async updateSourceFile(id: string, watchedDir: WatchedDir): Promise<boolean> {
		const sourceFile = this.files.get(id);
		if (sourceFile) {
			if (sourceFile.type !== 'source') {
				throw Error(`Expected to update a source file but got type '${sourceFile.type}': ${id}`);
			}
			if (sourceFile.watchedDir !== watchedDir) {
				// This can happen when there are overlapping watchers.
				// We might be able to support this,
				// but more thought needs to be given to the exact desired behavior.
				// See `validateCompiledDirs` for more.
				throw Error(
					'Source file watchedDir unexpectedly changed: ' +
						`${sourceFile.id} changed from ${sourceFile.watchedDir.dir} to ${watchedDir.dir}`,
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
		const newSourceContents = await loadContents(encoding, id);

		let newSourceFile: SourceFile;
		if (!sourceFile) {
			// Memory cache is cold.
			// TODO add hash caching to avoid this work when not needed
			// (base on source id hash comparison combined with compile options diffing like sourcemaps and ES target)
			newSourceFile = createSourceFile(id, encoding, extension, newSourceContents, watchedDir);
		} else if (areContentsEqual(encoding, sourceFile.contents, newSourceContents)) {
			// Memory cache is warm and source code hasn't changed, do nothing and exit early!
			// But wait, what if the source maps are missing because the `sourceMap` option was off
			// the last time the files were built?
			// We're going to assume that if the source maps exist, they're in sync,
			// in the same way that we're assuming that the build file is in sync if it exists
			// when the cached source file hasn't changed.
			// TODO remove this check once we diff compiler options
			if (
				!this.sourceMap ||
				(sourceFile.compiledFiles !== null && (await sourceMapsAreBuilt(sourceFile)))
			) {
				return false;
			}
			newSourceFile = sourceFile;
		} else {
			// Memory cache is warm, but contents have changed.
			switch (sourceFile.encoding) {
				case 'utf8':
					newSourceFile = {
						...sourceFile,
						contents: newSourceContents as string,
						stats: undefined,
						buffer: undefined,
					};
					break;
				case null:
					newSourceFile = {
						...sourceFile,
						contents: newSourceContents as Buffer,
						stats: undefined,
						buffer: newSourceContents as Buffer,
					};
					break;
				default:
					throw new UnreachableError(sourceFile);
			}
		}
		this.files.set(id, newSourceFile);
		return true;
	}

	// These are used to avoid concurrent compilations for any given source file.
	private pendingCompilations: Set<string> = new Set();
	private enqueuedCompilations: Map<string, [string, WatchedDir]> = new Map();

	// This wrapper function protects against race conditions
	// that could occur with concurrent compilations.
	// If a file is currently being compiled, it enqueues the file id,
	// and when the current compilation finishes,
	// it removes the item from the queue and recompiles the file.
	// The queue stores at most one compilation per file,
	// and this is safe given that compiling accepts no parameters.
	private async compileSourceId(id: string, watchedDir: WatchedDir): Promise<void> {
		if (this.buildConfigs === null || watchedDir.outDir === null || !this.include(id)) {
			return;
		}
		if (this.pendingCompilations.has(id)) {
			this.enqueuedCompilations.set(id, [id, watchedDir]);
			return;
		}
		this.pendingCompilations.add(id);
		try {
			await this.compileSourceIdForBuildConfigs(id, this.buildConfigs);
		} catch (err) {
			this.log.error(red('failed to compile'), printPath(id), printError(err));
		}
		this.pendingCompilations.delete(id);
		const enqueuedCompilation = this.enqueuedCompilations.get(id);
		if (enqueuedCompilation !== undefined) {
			this.enqueuedCompilations.delete(id);
			// Something changed during the compilation for this file, so recurse.
			// TODO do we need to detect cycles? if we run into any, probably
			if (await this.updateSourceFile(...enqueuedCompilation)) {
				await this.compileSourceId(...enqueuedCompilation);
			}
		}
	}

	private async compileSourceIdForBuildConfigs(
		id: string,
		buildConfigs: BuildConfig[],
	): Promise<void> {
		await Promise.all(
			buildConfigs.map((buildConfig) => this.compileSourceIdForBuildConfig(id, buildConfig)),
		);
	}

	private async compileSourceIdForBuildConfig(id: string, buildConfig: BuildConfig): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile) {
			throw Error(`Cannot find source file ${id}`);
		}
		if (sourceFile.type !== 'source') {
			throw Error(`Cannot compile file with type '${sourceFile.type}': ${id}`);
		}
		if (sourceFile.outDir === null) {
			throw Error(`Cannot compile file with a null outDir`);
		}

		// Compile the source file.
		const result = await this.compiler!.compile(sourceFile, buildConfig);

		// Update the cache and write to disk.
		const newCompiledFiles = result.compilations.map(
			(compilation): CompiledFile => {
				switch (compilation.encoding) {
					case 'utf8':
						return {
							type: 'compiled',
							sourceFile,
							id: compilation.id,
							filename: compilation.filename,
							dir: compilation.dir,
							extension: compilation.extension,
							encoding: compilation.encoding,
							contents: postprocess(compilation),
							sourceMapOf: compilation.sourceMapOf,
							compilation,
							stats: undefined,
							mimeType: undefined, // TODO copy from old file? it's cheap enough to not be necessary, but what about other properties?
							buffer: undefined,
						};
					case null:
						return {
							type: 'compiled',
							sourceFile,
							id: compilation.id,
							filename: compilation.filename,
							dir: compilation.dir,
							extension: compilation.extension,
							encoding: compilation.encoding,
							contents: postprocess(compilation),
							compilation,
							stats: undefined,
							mimeType: undefined, // TODO copy from old file? it's cheap enough to not be necessary, but what about other properties?
							buffer: compilation.contents,
						};
					default:
						throw new UnreachableError(compilation);
				}
			},
		);
		const newSourceFile = {...sourceFile, compiledFiles: newCompiledFiles};
		this.files.set(id, newSourceFile);
		const oldCompiledFiles = sourceFile.compiledFiles;
		syncCompiledFilesToMemoryCache(this.files, newCompiledFiles, oldCompiledFiles, this.log);
		await syncFilesToDisk(newCompiledFiles, oldCompiledFiles, this.log);
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile || sourceFile.type !== 'source') return; // ignore compiled files (maybe throw an error if the file isn't found, should not happen)
		this.log.trace('destroying file', printPath(id));
		this.files.delete(id);
		if (sourceFile.compiledFiles !== null) {
			syncCompiledFilesToMemoryCache(this.files, [], sourceFile.compiledFiles, this.log);
			await syncFilesToDisk([], sourceFile.compiledFiles, this.log);
		}
	}
}

// The check is needed to handle source maps being toggled on and off.
// It assumes that if we find any source maps, the rest are there.
const sourceMapsAreBuilt = async (sourceFile: CompilableSourceFile): Promise<boolean> => {
	const sourceMapFile = sourceFile.compiledFiles.find((f) =>
		f.encoding === 'utf8' ? f.sourceMapOf : false,
	);
	if (!sourceMapFile) return true;
	return pathExists(sourceMapFile.id);
};

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
		...oldFiles.map((oldFile) => {
			if (!newFiles.find((f) => f.id === oldFile.id)) {
				log.trace('deleting file on disk', printPath(oldFile.id));
				return remove(oldFile.id);
			}
			return undefined;
		}),
		...newFiles.map(async (newFile) => {
			const oldFile = oldFiles.find((f) => f.id === newFile.id);
			let shouldOutputNewFile = false;
			if (!oldFile) {
				if (!(await pathExists(newFile.id))) {
					log.trace('creating file on disk', printPath(newFile.id));
					shouldOutputNewFile = true;
				} else {
					// TODO optimize - content hash cache?
					const existingCotents = await loadContents(newFile.encoding, newFile.id);
					if (!areContentsEqual(newFile.encoding, newFile.contents, existingCotents)) {
						log.trace('updating stale file on disk', printPath(newFile.id));
						shouldOutputNewFile = true;
					} // else the file on disk is already updated
				}
			} else if (!areContentsEqual(newFile.encoding, newFile.contents, oldFile.contents)) {
				log.trace('updating file on disk', printPath(newFile.id));
				shouldOutputNewFile = true;
			} // else nothing changed, no need to update
			if (shouldOutputNewFile) await outputFile(newFile.id, newFile.contents);
		}),
	]);
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
			if (newFile.sourceFile.id !== oldFile.sourceFile.id) {
				throw Error(
					'Two source files are trying to compile to the same output location: ' +
						`${newFile.sourceFile.id} & ${oldFile.sourceFile.id}`,
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

export const getFileBuffer = (file: BaseFile): Buffer =>
	file.buffer !== undefined ? file.buffer : (file.buffer = Buffer.from(file.contents));

// Stats are currently lazily loaded. Should they be?
export const getFileStats = (file: BaseFile): Stats | Promise<Stats> =>
	file.stats !== undefined
		? file.stats
		: stat(file.id).then((stats) => {
				file.stats = stats;
				return stats;
		  }); // TODO catch?

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

// TODO this needs some major refactoring and redesigning
function postprocess(compilation: TextCompilation): string;
function postprocess(compilation: BinaryCompilation): Buffer;
function postprocess(compilation: Compilation) {
	if (compilation.encoding === 'utf8' && compilation.extension === JS_EXTENSION) {
		let result = '';
		let index = 0;
		const {contents} = compilation;
		// TODO what should we pass as the second arg to parse? the id? nothing? `lexer.parse(code, id);`
		const [imports] = lexer.parse(contents);
		for (const {s, e, d} of imports) {
			const start = d > -1 ? s + 1 : s;
			const end = d > -1 ? e - 1 : e;
			const moduleName = contents.substring(start, end);
			if (moduleName.endsWith(SVELTE_EXTENSION)) {
				result += contents.substring(index, start) + replaceExtension(moduleName, JS_EXTENSION);
				index = end;
			}
		}
		if (index > 0) {
			return result + contents.substring(index);
		} else {
			return contents;
		}
	}
	return compilation.contents;
}

// TODO revisit these restrictions - the goal right now is to set limits
// to avoid undefined behavior at the cost of flexibility
const validateCompiledDirs = (compiledDirs: CompiledDir[]) => {
	for (const compiledDir of compiledDirs) {
		// Make sure no `outDir` is inside a `sourceDir`.
		// In the current design, the entire source directory is watched, so in this case,
		// compiled files would become source files and cause a more cryptic error.
		const nestedOutDir = compiledDirs.find((d) => compiledDir.outDir.startsWith(d.sourceDir));
		if (nestedOutDir) {
			throw Error(
				'Compiled outDir cannot be inside a sourceDir: ' +
					`${compiledDir.outDir} is inside ${nestedOutDir.sourceDir}`,
			);
		}
		// Make sure no `sourceDir` is inside another `sourceDir`.
		// This could probably be fixed to allow the nested one's `outDir` to take precedence.
		// The current implementation appears to work, if inefficiently,
		// only throwing an error when it detects that a source file's `watchedDir` has changed.
		// However there may be subtle bugs caused by source files changing their `watcherDir`,
		// so for now we err on the side of caution and less complexity.
		const nestedSourceDir = compiledDirs.find(
			(d) => d !== compiledDir && compiledDir.sourceDir.startsWith(d.sourceDir),
		);
		if (nestedSourceDir) {
			throw Error(
				'Compiled sourceDir cannot be inside another sourceDir: ' +
					`${compiledDir.sourceDir} is inside ${nestedSourceDir.sourceDir}`,
			);
		}
	}
};

const createSourceFile = (
	id: string,
	encoding: Encoding,
	extension: string,
	newSourceContents: string | Buffer,
	watchedDir: WatchedDir,
): SourceFile => {
	const filename = basename(id);
	const dir = dirname(id) + '/'; // TODO this is currently needed because paths.sourceId and the rest have a trailing slash, but this may cause other problems
	switch (encoding) {
		case 'utf8':
			return watchedDir.outDir === null
				? {
						type: 'source',
						id,
						filename,
						dir,
						extension,
						encoding,
						contents: newSourceContents as string,
						watchedDir,
						compiledFiles: null,
						outDir: null,
						stats: undefined,
						mimeType: undefined,
						buffer: undefined,
				  }
				: {
						type: 'source',
						id,
						filename,
						dir,
						extension,
						encoding,
						contents: newSourceContents as string,
						watchedDir,
						compiledFiles: [],
						outDir: watchedDir.computeFileOutDir(dir),
						stats: undefined,
						mimeType: undefined,
						buffer: undefined,
				  };
		case null:
			return watchedDir.outDir === null
				? {
						type: 'source',
						id,
						filename,
						dir,
						extension,
						encoding,
						contents: newSourceContents as Buffer,
						watchedDir,
						compiledFiles: null,
						outDir: null,
						stats: undefined,
						mimeType: undefined,
						buffer: newSourceContents as Buffer,
				  }
				: {
						type: 'source',
						id,
						filename,
						dir,
						extension,
						encoding,
						contents: newSourceContents as Buffer,
						watchedDir,
						compiledFiles: [],
						outDir: watchedDir.computeFileOutDir(dir),
						stats: undefined,
						mimeType: undefined,
						buffer: newSourceContents as Buffer,
				  };
		default:
			throw new UnreachableError(encoding);
	}
};

// Creates objects to load a directory's contents and sync filesystem changes in memory.
// The order of objects in the returned array is meaningless.
const createWatchedDirs = (
	compiledDirs: CompiledDir[],
	servedDirs: string[],
	watch: boolean,
	debounce: number,
	onChange: WatchedDirChangeCallback,
): WatchedDir[] => {
	const dirs: WatchedDir[] = [];
	// TODO what about compiled directories inside others? should we only created WatchedDirs for the root-most directory?
	// or maybe we should just run a validation routine to disallow nested compiledDirs?
	for (const {sourceDir, outDir} of compiledDirs) {
		// The `outDir` is automatically in the Filer's memory cache for compiled files,
		// so no need to load it as a directory.
		dirs.push(createWatchedDir(sourceDir, outDir, watch, debounce, onChange));
	}
	if (watch) {
		for (const servedDir of servedDirs) {
			// If a `servedDir` is inside a compiled directory's `sourceDir` or `outDir`,
			// it's already in the Filer's memory cache and does not need to be loaded as a directory.
			// Additionally, the same is true for `servedDir`s that are inside other `servedDir`s.
			if (
				!compiledDirs.find(
					(d) => servedDir.startsWith(d.sourceDir) || servedDir.startsWith(d.outDir),
				) &&
				!servedDirs.find((d) => d !== servedDir && servedDir.startsWith(d))
			) {
				dirs.push(createWatchedDir(servedDir, null, watch, debounce, onChange));
			}
		}
	}
	return dirs;
};

// There are two kinds of `WatchedDir`s, those created with an `outDir` and those without.
// If there's an `outDir` the `dir` will be compiled to it and written to disk.
// If `outDir` is null, the `dir` is only watched and nothing is written back to the filesystem.
type WatchedDir = CompilableWatchedDir | NonCompilableWatchedDir;
type WatchedDirChangeCallback = (change: WatcherChange, watchedDir: WatchedDir) => Promise<void>;
interface CompilableWatchedDir extends BaseWatchedDir {
	readonly outDir: string;
	readonly computeFileOutDir: (dir: string) => string;
}
interface NonCompilableWatchedDir extends BaseWatchedDir {
	readonly outDir: null;
}
interface BaseWatchedDir {
	readonly dir: string;
	readonly watcher: WatchNodeFs;
	readonly onChange: WatchedDirChangeCallback;
	readonly destroy: () => void;
	readonly init: () => Promise<void>;
}
const createWatchedDir = (
	dir: string,
	outDir: string | null,
	watch: boolean,
	debounce: number,
	onChange: WatchedDirChangeCallback,
): WatchedDir => {
	const watcher = watchNodeFs({
		dir,
		debounce,
		watch,
		onChange: (change) => onChange(change, watchedDir),
	});
	const destroy = () => {
		watcher.destroy();
	};
	const init = async () => {
		await Promise.all([ensureDir(dir), outDir === null ? null : ensureDir(outDir)]);
		const statsBySourcePath = await watcher.init();
		await Promise.all(
			Array.from(statsBySourcePath.entries()).map(([path, stats]) =>
				stats.isDirectory() ? null : onChange({type: 'update', path, stats}, watchedDir),
			),
		);
	};
	const watchedDir: WatchedDir =
		outDir === null
			? {
					dir,
					outDir,
					onChange,
					watcher,
					destroy,
					init,
			  }
			: {
					dir,
					outDir,
					onChange,
					watcher,
					destroy,
					init,
					computeFileOutDir: (fileDir: string): string => {
						return join(outDir, stripStart(fileDir, dir));
					},
			  };
	return watchedDir;
};
