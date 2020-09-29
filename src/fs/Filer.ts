import {resolve, extname, join} from 'path';
import lexer from 'es-module-lexer';

import {ensureDir, stat, Stats} from './nodeFs.js';
import {watchNodeFs, DEBOUNCE_DEFAULT, WatcherChange} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {
	basePathToBuildId,
	basePathToSourceId,
	fromSourceMappedBuildIdToSourceId,
	JS_EXTENSION,
	paths,
	SVELTE_EXTENSION,
	toSourceId,
	toSvelteExtension,
} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {PathStats} from '../fs/pathData.js';
import {findFiles, readFile, remove, outputFile, pathExists} from '../fs/nodeFs.js';
import type {AsyncStatus} from '../utils/async.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta, red} from '../colors/terminal.js';
import {printError, printPath} from '../utils/print.js';
import {Compiler, TextCompilation, BinaryCompilation, Compilation} from '../compile/compiler.js';
import {getMimeTypeByExtension} from './mime.js';
import {Encoding, inferEncoding} from './encoding.js';
import {replaceExtension} from '../utils/path.js';

export type FilerFile = SourceFile | CompiledFile; // TODO or Directory? source/compiled directory?

export type SourceFile = TextSourceFile | BinarySourceFile;
interface BaseSourceFile extends BaseFile {
	type: 'source';
	compiledFiles: CompiledFile[];
}
export interface TextSourceFile extends BaseSourceFile {
	encoding: 'utf8';
	contents: string;
}
export interface BinarySourceFile extends BaseSourceFile {
	encoding: null;
	contents: Buffer;
	compiledFiles: CompiledFile[];
	buffer: Buffer;
}

export type CompiledFile = CompiledTextFile | CompiledBinaryFile;
export interface BaseCompiledFile extends BaseFile {
	type: 'compiled';
}
export interface CompiledTextFile extends BaseCompiledFile {
	// sourceFile: SourceTextFile; // TODO add this reference?
	compilation: TextCompilation;
	encoding: 'utf8';
	contents: string;
	sourceMapOf: string | null; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
}
export interface CompiledBinaryFile extends BaseCompiledFile {
	// sourceFile: SourceBinaryFile; // TODO add this reference?
	compilation: BinaryCompilation;
	encoding: null;
	contents: Buffer;
	buffer: Buffer;
}

export interface BaseFile {
	id: string;
	extension: string;
	encoding: Encoding;
	contents: string | Buffer;
	stats: Stats | undefined; // `undefined` for lazy loading
	mimeType: string | null | undefined; // `null` means unknown, `undefined` for lazy loading
	buffer: Buffer | undefined; // `undefined` for lazy loading
}

interface Options {
	compiler: Compiler | null;
	include: (id: string) => boolean;
	sourceMap: boolean;
	sourceDir: string;
	buildDir: string;
	servedDirs: string[];
	debounce: number;
	watch: boolean;
	log: Logger;
}
type InitialOptions = Partial<Options>;
const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([magenta('[filer]')]);
	return {
		compiler: null,
		sourceMap: true,
		sourceDir: paths.source,
		buildDir: paths.build,
		debounce: DEBOUNCE_DEFAULT,
		watch: true,
		...omitUndefined(opts),
		include: opts.include || (() => true),
		log,
		servedDirs: (opts.servedDirs || [paths.build]).map((d) => resolve(d)),
	};
};

export class Filer {
	private readonly watcher: WatchNodeFs;

	private readonly compiler: Compiler | null;
	private readonly sourceMap: boolean;
	private readonly log: Logger;
	private readonly buildDir: string;
	private readonly include: (id: string) => boolean;

	private readonly files: Map<string, FilerFile> = new Map();
	private readonly servedDirs: string[];

	private initStatus: AsyncStatus = 'initial';

	constructor(opts: InitialOptions) {
		const {
			compiler,
			include,
			sourceMap,
			sourceDir,
			buildDir,
			servedDirs,
			debounce,
			watch,
			log,
		} = initOptions(opts);
		this.compiler = compiler;
		this.include = include;
		this.sourceMap = sourceMap;
		this.log = log;
		this.buildDir = buildDir;
		this.servedDirs = servedDirs;
		this.watcher = watchNodeFs({
			dir: sourceDir,
			debounce,
			watch,
			onChange: this.onWatcherChange,
		});
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
		this.watcher.destroy();
	}

	private initializing: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.initializing) return this.initializing;
		let finishInitializing: () => void;
		this.initializing = new Promise((r) => (finishInitializing = r));
		this.initStatus = 'pending';

		await ensureDir(this.buildDir);

		const [statsBySourcePath, statsByBuildPath] = await Promise.all([
			this.watcher.init(),
			findFiles(this.buildDir, undefined, null),
			lexer.init,
		]);

		const statsBySourceId = new Map<string, PathStats>();
		for (const [path, stats] of statsBySourcePath) {
			statsBySourceId.set(basePathToSourceId(path), stats);
		}
		const buildIds = Array.from(statsByBuildPath.keys()).map((p) => basePathToBuildId(p));

		// This pattern helps us more easily parallelize work.
		const promises: Promise<void>[] = [];

		// Clean up the build directory, removing any files that can't be mapped back to source files.
		// This id helper makes it so `foo.js.map` files get deleted if source maps are turned off,
		// unless there's a `foo.js.map` file in the source directory.
		const fromBuildIdToSourceId = this.sourceMap ? fromSourceMappedBuildIdToSourceId : toSourceId;
		for (const buildId of buildIds) {
			const sourceId = fromBuildIdToSourceId(buildId);
			if (statsBySourceId.has(sourceId)) continue;
			const svelteSourceId = toSvelteExtension(sourceId);
			if (statsBySourceId.has(svelteSourceId)) continue;
			promises.push(remove(buildId));
		}
		await Promise.all(promises);
		promises.length = 0;

		// Compile the source files and update the build directory's files and directories.
		for (const [id, stats] of statsBySourceId) {
			if (!stats.isDirectory()) {
				promises.push(
					this.updateSourceFile(id).then((updated) =>
						updated ? this.compileSourceId(id) : undefined,
					),
				);
			}
		}

		await Promise.all(promises);

		this.initStatus = 'success';

		// We initialize the watcher at the beginning of `init`,
		// but this means watcher events may arrive before finishing.
		// Those should be enqueued until the `initStatus` is 'success',
		// so we can flush them here to get up to speed.
		await this.flushEnqueuedWatcherChanges();

		finishInitializing!();
	}

	private onWatcherChange = async (change: WatcherChange): Promise<void> => {
		if (this.initStatus !== 'success') {
			this.enqueuedWatcherChanges.push(change);
			return;
		}
		const id = basePathToSourceId(change.path);
		switch (change.type) {
			case 'create':
			case 'update': {
				if (change.stats.isDirectory()) {
					// We could ensure the directory, but it's usually wasted work,
					// and `fs-extra` takes care of adding missing directories when writing to disk.
				} else {
					if (await this.updateSourceFile(id)) {
						await this.compileSourceId(id);
					}
				}
				break;
			}
			case 'delete': {
				if (change.stats.isDirectory()) {
					// Although we don't pre-emptively create build directories above, we do delete them.
					await remove(basePathToBuildId(change.path));
				} else {
					await this.destroySourceId(id);
				}
				break;
			}
			default:
				throw new UnreachableError(change.type);
		}
	};

	// These sets of ids are used to avoid concurrent compilations for any given source file.
	private pendingCompilations: Set<string> = new Set();
	private enqueuedCompilations: Set<string> = new Set();

	// This wrapper function protects against race conditions
	// that could occur with concurrent compilations.
	// If a file is currently being compiled, it enqueues the file id,
	// and when the current compilation finishes,
	// it removes the item from the queue and recompiles the file.
	// The queue stores at most one compilation per file,
	// and this is safe given that compiling accepts no parameters.
	private async compileSourceId(id: string): Promise<void> {
		if (this.compiler === null || !this.include(id)) return;
		if (this.pendingCompilations.has(id)) {
			this.enqueuedCompilations.add(id);
			return;
		}
		this.pendingCompilations.add(id);
		try {
			await this._compileSourceId(id);
		} catch (err) {
			this.log.error(red('failed to compile'), printPath(id), printError(err));
		}
		this.pendingCompilations.delete(id);
		if (this.enqueuedCompilations.delete(id)) {
			// Something changed during the compilation for this file, so recurse.
			// TODO do we need to detect cycles? if we run into any, probably
			if (await this.updateSourceFile(id)) {
				await this.compileSourceId(id);
			}
		}
	}

	private async _compileSourceId(id: string): Promise<void> {
		let sourceFile = this.files.get(id);
		if (!sourceFile) {
			throw Error(`Cannot find source file ${id}`);
		}
		if (sourceFile.type !== 'source') {
			throw Error(`Cannot compile file with type '${sourceFile.type}': ${id}`);
		}

		// Compile this one file, which may turn into one or many.
		const result = await this.compiler!.compile(sourceFile);

		// Update the cache.
		const oldFiles = sourceFile.compiledFiles;
		sourceFile.compiledFiles = result.compilations.map(
			(compilation): CompiledFile => {
				switch (compilation.encoding) {
					case 'utf8':
						return {
							type: 'compiled',
							id: compilation.id,
							extension: compilation.extension,
							encoding: compilation.encoding,
							contents: postprocess(compilation),
							sourceMapOf: compilation.sourceMapOf,
							compilation,
							stats: undefined,
							mimeType: undefined, // TODO copy from old file?
							buffer: undefined,
						};
					case null:
						return {
							type: 'compiled',
							id: compilation.id,
							extension: compilation.extension,
							encoding: compilation.encoding,
							contents: postprocess(compilation),
							compilation,
							stats: undefined,
							mimeType: undefined, // TODO copy from old file?
							buffer: compilation.contents,
						};
					default:
						throw new UnreachableError(compilation);
				}
			},
		);

		// Write to disk.
		await syncFilesToDisk(sourceFile.compiledFiles, oldFiles, this.log);
		await syncCompiledFilesToMemoryCache(this.files, sourceFile.compiledFiles, oldFiles, this.log);
	}

	// Returns a boolean indicating if the source file changed.
	private async updateSourceFile(id: string): Promise<boolean> {
		let sourceFile = this.files.get(id);
		if (sourceFile && sourceFile.type !== 'source') {
			throw Error(`Expected to update a source file but got type '${sourceFile.type}': ${id}`);
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

		if (!sourceFile) {
			// Memory cache is cold.
			switch (encoding) {
				case 'utf8':
					sourceFile = {
						type: 'source',
						id,
						extension,
						encoding,
						contents: newSourceContents as string,
						compiledFiles: [],
						stats: undefined,
						mimeType: undefined,
						buffer: undefined,
					};
					break;
				case null:
					sourceFile = {
						type: 'source',
						id,
						extension,
						encoding,
						contents: newSourceContents as Buffer,
						compiledFiles: [],
						stats: undefined,
						mimeType: undefined,
						buffer: newSourceContents as Buffer,
					};
					break;
				default:
					throw new UnreachableError(encoding);
			}
			this.files.set(id, sourceFile);
		} else if (areContentsEqual(encoding, sourceFile.contents, newSourceContents)) {
			// Memory cache is warm and source code hasn't changed, do nothing and exit early!
			// But wait, what if the source maps are missing because the `sourceMap` option was off
			// the last time the files were built?
			// We're going to assume that if the source maps exist, they're in sync,
			// in the same way that we're assuming that the build file is in sync if it exists
			// when the cached source file hasn't changed.
			// TODO remove this check once we diff compiler options
			if (!this.sourceMap || (await sourceMapsAreBuilt(sourceFile))) {
				return false;
			}
		} else {
			// TODO maybe don't mutate, and always create new objects?
			// Memory cache is warm, but contents have changed.
			sourceFile.contents = newSourceContents;
			sourceFile.stats = undefined;
			switch (encoding) {
				case 'utf8':
					sourceFile.buffer = undefined;
					break;
				case null:
					sourceFile.buffer = newSourceContents as Buffer;
					break;
				default:
					throw new UnreachableError(encoding);
			}
		}
		return true;
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.files.get(id);
		if (!sourceFile || sourceFile.type !== 'source') return; // ignore compiled files (maybe throw an error if the file isn't found, should not happen)
		this.log.trace('destroying file', printPath(id));
		this.files.delete(id);
		await syncFilesToDisk([], sourceFile.compiledFiles, this.log);
		await syncCompiledFilesToMemoryCache(this.files, [], sourceFile.compiledFiles, this.log);
	}

	private enqueuedWatcherChanges: WatcherChange[] = [];
	private async flushEnqueuedWatcherChanges(): Promise<void> {
		for (const change of this.enqueuedWatcherChanges) {
			await this.onWatcherChange(change);
		}
	}
}

// The check is needed to handle source maps being toggled on and off.
// It assumes that if we find any source maps, the rest are there.
const sourceMapsAreBuilt = async (sourceFile: SourceFile): Promise<boolean> => {
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
const syncCompiledFilesToMemoryCache = async (
	files: Map<string, BaseFile>,
	newFiles: CompiledFile[],
	oldFiles: CompiledFile[],
	_log: Logger,
): Promise<void> => {
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
