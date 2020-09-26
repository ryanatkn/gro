import {extname} from 'path';
import {ensureDir, stat, Stats} from './nodeFs.js';

import {watchNodeFs, DEBOUNCE_DEFAULT, WatcherChange} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {
	basePathToBuildId,
	basePathToSourceId,
	fromSourceMappedBuildIdToSourceId,
	paths,
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
import {Compiler, CompiledTextFile, CompiledBinaryFile} from '../compile/compiler.js';
import {getMimeTypeByExtension} from './mime.js';
import {Encoding, inferEncoding} from './encoding.js';

export type SourceFile = SourceTextFile | SourceBinaryFile;
interface BaseSourceFile {
	id: string;
	extension: string;
	compiledFiles: CompiledSourceFile[];
}
export interface SourceTextFile extends BaseSourceFile {
	encoding: 'utf8';
	contents: string;
	buffer: Buffer | undefined;
}
export interface SourceBinaryFile extends BaseSourceFile {
	encoding: null;
	contents: Buffer;
	buffer: Buffer;
}

export type CompiledSourceFile = CompiledSourceTextFile | CompiledSourceBinaryFile;
export interface CompiledSourceTextFile extends CompiledTextFile {
	stats: Stats | undefined; // `undefined` for lazy loading
	buffer: Buffer | undefined; // `undefined` for lazy loading
	mimeType: string | null | undefined; // `null` means unknown, `undefined` for lazy loading
}
export interface CompiledSourceBinaryFile extends CompiledBinaryFile {
	stats: Stats | undefined; // `undefined` for lazy loading
	buffer: Buffer;
	mimeType: string | null | undefined; // `null` means unknown, `undefined` for lazy loading
}

interface Options {
	compiler: Compiler;
	include: (id: string) => boolean;
	sourceMap: boolean;
	sourceDir: string;
	buildDir: string;
	debounce: number;
	watch: boolean;
	log: Logger;
}
type RequiredOptions = 'compiler';
type InitialOptions = PartialExcept<Options, RequiredOptions>;
const initOptions = (opts: InitialOptions): Options => ({
	sourceMap: true,
	sourceDir: paths.source,
	buildDir: paths.build,
	debounce: DEBOUNCE_DEFAULT,
	watch: true,
	...omitUndefined(opts),
	include: opts.include || (() => true),
	log: opts.log || new SystemLogger([magenta('[FileCache]')]),
});

export class FileCache {
	private readonly watcher: WatchNodeFs;

	private readonly compiler: Compiler;
	private readonly sourceMap: boolean;
	private readonly log: Logger;
	private readonly buildDir: string;
	private readonly include: (id: string) => boolean;

	private readonly sourceFiles: Map<string, SourceFile> = new Map();
	private readonly compiledFiles: Map<string, CompiledSourceFile> = new Map();

	private initStatus: AsyncStatus = 'initial';

	constructor(opts: InitialOptions) {
		const {compiler, include, sourceMap, sourceDir, buildDir, debounce, watch, log} = initOptions(
			opts,
		);
		this.compiler = compiler;
		this.include = include;
		this.sourceMap = sourceMap;
		this.log = log;
		this.buildDir = buildDir;
		this.watcher = watchNodeFs({
			dir: sourceDir,
			debounce,
			watch,
			onChange: this.onWatcherChange,
		});
	}

	// TODO support lazy loading for some files - how? via a regexp?
	// this will probably need to be async when that's added
	getCompiledFile(id: string): CompiledSourceFile | null {
		return this.compiledFiles.get(id) || null;
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
			if (!stats.isDirectory()) promises.push(this.compileSourceId(id));
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

	private onWatcherChange = async (
		change: WatcherChange,
		path: string,
		stats: PathStats,
	): Promise<void> => {
		if (this.initStatus !== 'success') {
			this.enqueuedWatcherChanges.push([change, path, stats]);
			return;
		}
		const id = basePathToSourceId(path);
		switch (change) {
			case 'create':
			case 'update': {
				if (stats.isDirectory()) {
					// We could ensure the directory, but it's usually wasted work,
					// and `fs-extra` takes care of adding missing directories when writing to disk.
				} else {
					await this.compileSourceId(id);
				}
				break;
			}
			case 'delete': {
				if (stats.isDirectory()) {
					// Although we don't pre-emptively create build directories above, we do delete them.
					await remove(basePathToBuildId(path));
				} else {
					await this.destroySourceId(id);
				}
				break;
			}
			default:
				throw new UnreachableError(change);
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
		if (!this.include(id)) return;
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
			await this.compileSourceId(id);
		}
	}

	private async _compileSourceId(id: string): Promise<void> {
		let sourceFile = this.sourceFiles.get(id);

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
						id,
						extension,
						encoding,
						contents: newSourceContents as string,
						buffer: undefined,
						compiledFiles: [],
					};
					break;
				case null:
					sourceFile = {
						id,
						extension,
						encoding,
						contents: newSourceContents as Buffer,
						buffer: newSourceContents as Buffer,
						compiledFiles: [],
					};
					break;
				default:
					throw new UnreachableError(encoding);
			}
			this.sourceFiles.set(id, sourceFile);
		} else if (areContentsEqual(encoding, sourceFile.contents, newSourceContents)) {
			// Memory cache is warm and source code hasn't changed, do nothing and exit early!
			// But wait, what if the source maps are missing because the `sourceMap` option was off
			// the last time the files were built?
			// We're going to assume that if the source maps exist, they're in sync,
			// in the same way that we're assuming that the build file is in sync if it exists
			// when the cached source file hasn't changed.
			if (!this.sourceMap || (await sourceMapsAreBuilt(sourceFile))) {
				return;
			}
		} else {
			// Memory cache is warm, but contents have changed.
			switch (encoding) {
				case 'utf8':
					sourceFile.contents = newSourceContents;
					sourceFile.buffer = undefined;
					break;
				case null:
					sourceFile.contents = newSourceContents;
					sourceFile.buffer = newSourceContents as Buffer;
					break;
				default:
					throw new UnreachableError(encoding);
			}
		}

		// Compile this one file, which may turn into one or many.
		const result = await this.compiler.compile(id, newSourceContents, sourceFile.extension);

		// Update the cache.
		const oldFiles = sourceFile.compiledFiles;
		// TODO maybe merge the interfaces for the `CompiledFile` and `CompiledSourceFile`,
		// won't need to do this inefficient copying or change the shape of objects
		sourceFile.compiledFiles = result.files.map((file) => {
			switch (file.encoding) {
				case 'utf8':
					return {...file, stats: undefined, mimeType: undefined, buffer: undefined};
				case null:
					return {...file, stats: undefined, mimeType: undefined, buffer: file.contents};
				default:
					throw new UnreachableError(file);
			}
		});

		// Write to disk.
		await syncFilesToDisk(sourceFile.compiledFiles, oldFiles, this.log);
		await syncFilesToMemoryCache(this.compiledFiles, sourceFile.compiledFiles, oldFiles, this.log);
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.sourceFiles.get(id);
		if (!sourceFile) return; // TODO file is ignored or there's a deeper issue - maybe add logging? or should we track handled files?
		this.log.trace('destroying file', printPath(id));
		this.sourceFiles.delete(id);
		await syncFilesToDisk([], sourceFile.compiledFiles, this.log);
		await syncFilesToMemoryCache(this.compiledFiles, [], sourceFile.compiledFiles, this.log);
	}

	private enqueuedWatcherChanges: [change: WatcherChange, path: string, stats: PathStats][] = [];
	private async flushEnqueuedWatcherChanges(): Promise<void> {
		for (const change of this.enqueuedWatcherChanges) {
			await this.onWatcherChange(...change);
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
	newFiles: CompiledSourceFile[],
	oldFiles: CompiledSourceFile[],
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
			} else if (newFile.contents !== oldFile.contents) {
				log.trace('updating file on disk', printPath(newFile.id));
				shouldOutputNewFile = true;
			} // else nothing changed, no need to update
			if (shouldOutputNewFile) await outputFile(newFile.id, newFile.contents);
		}),
	]);
};

// Given `newFiles` and `oldFiles`, updates the memory cache,
// deleting files that no longer exist and setting the new ones, replacing any old ones.
const syncFilesToMemoryCache = async (
	compiledFiles: Map<string, CompiledSourceFile>,
	newFiles: CompiledSourceFile[],
	oldFiles: CompiledSourceFile[],
	_log: Logger,
): Promise<void> => {
	// This uses `Array#find` because the arrays are expected to be small,
	// because we're currently only using it for individual file compilations,
	// but that assumption might change and cause this code to be slow.
	for (const oldFile of oldFiles) {
		if (!newFiles.find((f) => f.id === oldFile.id)) {
			// log.trace('deleting file from memory', printPath(oldFile.id));
			compiledFiles.delete(oldFile.id);
		}
	}
	for (const newFile of newFiles) {
		// log.trace('setting file in memory cache', printPath(newFile.id));
		compiledFiles.set(newFile.id, newFile);
	}
};

export const getFileMimeType = (file: CompiledSourceFile): string | null =>
	file.mimeType !== undefined
		? file.mimeType
		: (file.mimeType = getMimeTypeByExtension(file.extension.substring(1)));

export const getFileBuffer = (file: CompiledSourceFile): Buffer =>
	file.buffer !== undefined ? file.buffer : (file.buffer = Buffer.from(file.contents));

// Stats are currently lazily loaded. Should they be?
export const getFileStats = (file: CompiledSourceFile): Stats | Promise<Stats> =>
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
