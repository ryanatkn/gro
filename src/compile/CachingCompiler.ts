import {watchNodeFs, DEBOUNCE_DEFAULT, WatcherChange} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {
	basePathToBuildId,
	basePathToSourceId,
	fromSourceMappedBuildIdToSourceId,
	paths,
	toSourceId,
	toSvelteExtension,
	TS_EXTENSION,
} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {PathStats} from '../fs/pathData.js';
import {findFiles, readFile, remove, outputFile, pathExists} from '../fs/nodeFs.js';
import type {AsyncStatus} from '../utils/async.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta, red} from '../colors/terminal.js';
import {printError, printPath} from '../utils/print.js';
import {CompileResult, CompiledFile, CompileFile} from './compileFile.js';
import {extname} from 'path';

interface CachedCompilation {
	sourceId: string;
	sourceExtension: string;
	sourceContents: string;
	files: CompiledFile[];
}

interface Options {
	compileFile: CompileFile;
	sourceMap: boolean;
	log: Logger;
	sourceDir: string;
	buildDir: string;
	debounce: number;
}
type RequiredOptions = 'compileFile';
type InitialOptions = PartialExcept<Options, RequiredOptions>;
const initOptions = (opts: InitialOptions): Options => ({
	sourceMap: true,
	log: new SystemLogger([magenta('[CachingCompiler]')]),
	sourceDir: paths.source,
	buildDir: paths.build,
	debounce: DEBOUNCE_DEFAULT,
	...omitUndefined(opts),
});

export class CachingCompiler {
	protected readonly watcher: WatchNodeFs;

	readonly compileFile: CompileFile;
	readonly sourceMap: boolean;
	readonly log: Logger;
	readonly sourceDir: string;
	readonly buildDir: string;
	readonly compilations: Map<string, CachedCompilation> = new Map();

	initStatus: AsyncStatus = 'initial';

	constructor(opts: InitialOptions) {
		const {compileFile, sourceMap, log, sourceDir, buildDir, debounce} = initOptions(opts);
		this.compileFile = compileFile;
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
			promises.push(this.compileSourceId(id, stats.isDirectory()));
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
				this.compileSourceId(id, stats.isDirectory());
				break;
			}
			case 'delete': {
				this.destroySourceId(id);
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

	private async compileSourceId(id: string, isDirectory: boolean) {
		if (isDirectory) return; // TODO is this right? no behavior? the `fs-extra` methods handle missing directories
		if (!isDirectory && !id.endsWith(TS_EXTENSION)) return; // TODO svelte, markdown etc - defer to the `compileFile` prop

		const {compilations, log} = this;

		const sourceContents = await readFile(id, 'utf8');

		let compilation = compilations.get(id);
		if (!compilation) {
			// Memory cache is cold.
			compilation = {sourceId: id, sourceExtension: extname(id), sourceContents, files: []};
			compilations.set(id, compilation);
		} else if (compilation.sourceContents === sourceContents) {
			// Memory cache is warm and source code hasn't changed, do nothing and exit early!
			// But wait, what if the source maps are missing because the `sourceMap` option was off
			// the last time the files were built?
			// We're going to assume that if the source maps exist, they're in sync,
			// in the same way that we're assuming that the build file is in sync if it exists
			// when the cached source file hasn't changed.
			if (!this.sourceMap || (await sourceMapsAreBuilt(compilation))) {
				// TODO what about pending compilations? I think that'd be a bug, we'd need to track the current compilations and throw away work that's not the most recent
				return;
			}
		} else {
			// Memory cache is warm, but contents have changed.
			compilation.sourceContents = sourceContents;
		}

		// Compile this one file, which may turn into one or many.
		let result: CompileResult;
		try {
			result = await this.compileFile(id, sourceContents, compilation?.sourceExtension);
		} catch (err) {
			log.error(red('compileFile failed for'), printPath(id), printError(err));
			return;
		}

		// Update the cache.
		const oldFiles = compilation.files;
		compilation.files = result.files;

		// Write to disk.
		await syncFilesToDisk(compilation.files, oldFiles, log);
	}

	private async destroySourceId(id: string): Promise<void> {
		this.log.trace('destroying file', printPath(id));
		const compilation = this.compilations.get(id);
		if (!compilation) throw Error(`Cannot destroy missing compilation ${id}`);
		this.compilations.delete(id);
		await syncFilesToDisk([], compilation.files, this.log);
	}

	enqueuedWatcherChanges: [change: WatcherChange, path: string, stats: PathStats][] = [];
	private async flushEnqueuedWatcherChanges(): Promise<void> {
		for (const change of this.enqueuedWatcherChanges) {
			await this.onWatcherChange(...change);
		}
	}
}

// This assumes that if we find any source maps, the rest are there.
// Seems like a safe assumption. The check is really needed when toggling source maps on and off.
const sourceMapsAreBuilt = async (compilation: CachedCompilation): Promise<boolean> => {
	const sourceMapFile = compilation.files.find((f) => f.sourceMapOf);
	if (!sourceMapFile) return true;
	return pathExists(sourceMapFile.id);
	// This code checks all source maps. I think it's unnececessary.
	// let missing = false;
	// await Promise.all(
	// 	compilation.files.map(async (f) => {
	// 		if (f.sourceMapOf && !(await pathExists(f.sourceMapOf))) {
	// 			missing = true;
	// 		}
	// 	}),
	// );
	// return !missing;
};

// This uses `Array#find` because the arrays are expected to be small,
// because we're currently only using it for individual file compilations,
// but that assumption might change and cause this code to be slow.
const syncFilesToDisk = async (
	newFiles: CompiledFile[],
	oldFiles: CompiledFile[],
	log: Logger,
): Promise<void> => {
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
					log.trace('writing new file to disk', printPath(newFile.id));
					await outputFile(newFile.id, newFile.contents);
				}
				// else the cache was cold, but now it's warm
			} else if (oldFile.contents === newFile.contents) {
				return; // nothing changed, no need to update
			} else {
				log.trace('writing changed file to disk', printPath(newFile.id));
				await outputFile(newFile.id, newFile.contents);
			}
		}),
	]);
};
