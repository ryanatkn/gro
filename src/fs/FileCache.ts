import {extname} from 'path';
import {stat, Stats} from './nodeFs.js';

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
import {CompileResult, CompiledFile, Compiler} from '../compile/compiler.js';
import {getMimeTypeByExtension} from './mime.js';

export interface SourceFile {
	id: string;
	extension: string;
	contents: string;
	compiledFiles: CompiledSourceFile[];
}

export interface CompiledSourceFile extends CompiledFile {
	stats: Stats | undefined; // `undefined` for lazy loading
	buffer: Buffer | undefined; // TODO how to handle this?
	mimeType: string | null | undefined; // `null` means unknown, `undefined` for lazy loading
}

interface Options {
	compiler: Compiler;
	include: RegExp; // TODO maybe use Rollup pluginutils `createFilter` instead of a plain regexp
	sourceMap: boolean;
	sourceDir: string;
	buildDir: string;
	debounce: number;
	log: Logger;
}
type RequiredOptions = 'compiler';
type InitialOptions = PartialExcept<Options, RequiredOptions>;
const initOptions = (opts: InitialOptions): Options => ({
	sourceMap: true,
	sourceDir: paths.source,
	buildDir: paths.build,
	debounce: DEBOUNCE_DEFAULT,
	...omitUndefined(opts),
	include: opts.include || /\.(ts|js|svelte|css|html)$/,
	log: opts.log || new SystemLogger([magenta('[FileCache]')]),
});

export class FileCache {
	readonly watcher: WatchNodeFs;

	readonly compiler: Compiler;
	readonly sourceMap: boolean;
	readonly log: Logger;
	readonly sourceDir: string;
	readonly buildDir: string;
	readonly include: RegExp;

	readonly sourceFiles: Map<string, SourceFile> = new Map();

	initStatus: AsyncStatus = 'initial';

	constructor(opts: InitialOptions) {
		const {compiler, include, sourceMap, sourceDir, buildDir, debounce, log} = initOptions(opts);
		this.compiler = compiler;
		this.include = include;
		this.sourceMap = sourceMap;
		this.log = log;
		this.sourceDir = sourceDir;
		this.buildDir = buildDir;
		this.watcher = watchNodeFs({
			dir: sourceDir,
			debounce,
			onChange: this.onWatcherChange,
		});
	}

	// async getSourceFile(id: string): Promise<SourceFile | null> {
	// 	const sourceFile = this.sourceFiles.get(id);
	// 	if (!sourceFile) return null;
	// 	// TODO support lazy loading for some files - how? via a regexp?
	// 	return sourceFile;
	// }

	// TODO support lazy loading for some files - how? via a regexp?
	// this will probably need to be async when that's added
	getCompiledFile(id: string): CompiledSourceFile | null {
		for (const sourceFile of this.sourceFiles.values()) {
			for (const compiledFile of sourceFile.compiledFiles) {
				if (compiledFile.id === id) return compiledFile;
			}
		}
		return null;
		// TODO cache compiled files for faster lookup
		// const compiledFile = this.compiledFiles.get(id);
		// if (!compiledFile) return null;
		// return compiledFile;
	}

	destroy(): void {
		this.watcher.destroy();
	}

	async init(): Promise<void> {
		if (this.initStatus !== 'initial') throw Error(`init cannot be called twice`);
		this.initStatus = 'pending';

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

		// For efficiency, we initialize the watcher at the beginning of `init`,
		// but this means watcher events may arrive before we finish initialization.
		// Those should be enqueued until the `initStatus` is 'success',
		// so we can flush them here to get up to speed.
		await this.flushEnqueuedWatcherChanges();
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

	// TODO similarly to the flushing enqueued changes,
	// we may need to defer queries with a "compile lock" against the cache until any current processing is complete,
	// at least for particular files,
	// otherwise you may see bad mutated values while it's reading or writing to disk in `compileSourceId`.
	// could it be as simple as `await currentCompilations`?
	// or can we set `contents` to be `string | null` and be done with it?
	// We could save each id being compiled in a map or set, and cancel compilation if a new one comes in,
	// or store a global counter that increments each compile call, and store that in a map by id
	// during compilation, after each async call check if the original id in the function closure is still current,
	// and if not abort early

	private async compileSourceId(id: string) {
		if (!this.include.test(id)) return;
		const {sourceFiles, log} = this;

		const sourceContents = await readFile(id, 'utf8');

		let sourceFile = sourceFiles.get(id);
		if (!sourceFile) {
			// Memory cache is cold.
			sourceFile = {id: id, extension: extname(id), contents: sourceContents, compiledFiles: []};
			sourceFiles.set(id, sourceFile);
		} else if (sourceFile.contents === sourceContents) {
			// Memory cache is warm and source code hasn't changed, do nothing and exit early!
			// But wait, what if the source maps are missing because the `sourceMap` option was off
			// the last time the files were built?
			// We're going to assume that if the source maps exist, they're in sync,
			// in the same way that we're assuming that the build file is in sync if it exists
			// when the cached source file hasn't changed.
			if (!this.sourceMap || (await sourceMapsAreBuilt(sourceFile))) {
				// TODO what about pending compilations? I think that'd be a bug, we'd need to track the current compilations and throw away work that's not the most recent
				return;
			}
		} else {
			// Memory cache is warm, but contents have changed.
			sourceFile.contents = sourceContents;
		}

		// Compile this one file, which may turn into one or many.
		let result: CompileResult;
		try {
			result = await this.compiler.compile(id, sourceContents, sourceFile.extension);
		} catch (err) {
			log.error(red('compiler failed for'), printPath(id), printError(err));
			return;
		}

		// Update the cache.
		const oldFiles = sourceFile.compiledFiles;
		sourceFile.compiledFiles = result.files.map((file) => ({
			...file,
			mimeType: undefined,
			buffer: undefined,
			stats: undefined,
		}));

		// Write to disk.
		await syncFilesToDisk(sourceFile.compiledFiles, oldFiles, log);
	}

	private async destroySourceId(id: string): Promise<void> {
		const sourceFile = this.sourceFiles.get(id);
		if (!sourceFile) return; // TODO file is ignored or there's a deeper issue - maybe add logging? or should we track handled files?
		this.log.trace('destroying file', printPath(id));
		this.sourceFiles.delete(id);
		await syncFilesToDisk([], sourceFile.compiledFiles, this.log);
	}

	enqueuedWatcherChanges: [change: WatcherChange, path: string, stats: PathStats][] = [];
	private async flushEnqueuedWatcherChanges(): Promise<void> {
		for (const change of this.enqueuedWatcherChanges) {
			await this.onWatcherChange(...change);
		}
	}
}

// The check is needed to handle source maps being toggled on and off.
// It assumes that if we find any source maps, the rest are there.
const sourceMapsAreBuilt = async (sourceFile: SourceFile): Promise<boolean> => {
	const sourceMapFile = sourceFile.compiledFiles.find((f) => f.sourceMapOf);
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
			if (!oldFile) {
				if (
					!(await pathExists(newFile.id)) ||
					(await readFile(newFile.id, 'utf8')) !== newFile.contents
				) {
					log.trace('creating file on disk', printPath(newFile.id));
					await outputFile(newFile.id, newFile.contents);
				}
			} else if (oldFile.contents === newFile.contents) {
				return; // nothing changed, no need to update
			} else {
				log.trace('updating file on disk', printPath(newFile.id));
				await outputFile(newFile.id, newFile.contents);
			}
		}),
	]);
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
