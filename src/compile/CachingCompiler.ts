import {watchNodeFs, DEBOUNCE_DEFAULT, WatcherChange} from '../fs/watchNodeFs.js';
import type {WatchNodeFs} from '../fs/watchNodeFs.js';
import {
	basePathToBuildId,
	basePathToSourceId,
	fromSourceMappedBuildIdToSourceId,
	paths,
	SOURCE_MAP_EXTENSION,
	toBuildId,
	toSourceId,
	toSvelteExtension,
	TS_EXTENSION,
} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {PathStats} from '../fs/pathData.js';
import {findFiles, readFile, remove, ensureDir, outputFile, pathExists} from '../fs/nodeFs.js';
import type {AsyncStatus} from '../utils/async.js';
import {UnreachableError} from '../utils/error.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta, red} from '../colors/terminal.js';
import {printError, printPath} from '../utils/print.js';
import {CompiledOutput, CompileFile} from './compileFile.js';

// TODO look at unifying `PathInfo` with `PathData`, also `nodeFile.ts` with `loadFile` and `File`
type PathInfo = FilePathInfo | DirectoryPathInfo;
interface FilePathInfo {
	id: string;
	isDirectory: false;
	// can be `null` during the file's compilation process
	// TODO is this type the best way to handle this issue?
	// happens on initialization, and maybe on errors?
	// or do we keep previous values on errors?
	contents: string | null;
}
interface DirectoryPathInfo {
	id: string;
	isDirectory: true;
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
	readonly pathInfoByBuildId: Map<string, PathInfo> = new Map();
	readonly pathInfoBySourceId: Map<string, PathInfo> = new Map();

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
		if (!isDirectory && !id.endsWith(TS_EXTENSION)) return; // TODO svelte, markdown etc - defer to the `compileFile` prop

		const {pathInfoBySourceId, pathInfoByBuildId, log} = this;

		// We're not trusting 'create' vs 'update' from our file watcher.
		// I think things are still efficient despite the slightly more complicated code.
		// The flags `sourceNotInCache` and `buildNotInCache` handle those conditions.
		let sourcePathInfo = pathInfoBySourceId.get(id);
		let sourceNotInCache = !sourcePathInfo;
		if (sourceNotInCache) {
			sourcePathInfo = isDirectory
				? {id, isDirectory: true}
				: {id, isDirectory: false, contents: null};
			pathInfoBySourceId.set(id, sourcePathInfo);
		}
		const buildId = toBuildId(id);
		let buildPathInfo = pathInfoByBuildId.get(buildId);
		let buildNotInCache = !buildPathInfo;
		if (buildNotInCache) {
			// Read from disk and cache if it's a file.
			// We can't defer populating the cache from disk because
			// we exit early before getting to the `buildPathInfo.contents` comparison below
			// if the source file has not changed.
			// However we could parallelize this with reading the `sourceContents` from disk below.
			buildPathInfo = isDirectory
				? {id: buildId, isDirectory: true}
				: {
						id: buildId,
						isDirectory: false,
						contents: (await pathExists(buildId)) ? await readFile(buildId, 'utf8') : null,
				  };
			pathInfoByBuildId.set(buildId, buildPathInfo);
		}
		if (isDirectory) {
			// Handle a new or updated directory and exit early!
			if (buildNotInCache) {
				// TODO can we get away without this? seems a bit excessive
				// given the filesystem APIs automatically create necessary directories
				await ensureDir(buildId);
			}
			return;
		}

		// TypeScript workaround - by this point we're exited for directories
		sourcePathInfo = sourcePathInfo as FilePathInfo;
		buildPathInfo = buildPathInfo as FilePathInfo;

		const buildSourceMapId = buildId + SOURCE_MAP_EXTENSION;

		// Handle a new or updated file
		const sourceContents = await readFile(id, 'utf8');
		if (sourcePathInfo.contents !== sourceContents) {
			sourcePathInfo.contents = sourceContents;
		} else {
			// Source code hasn't changed, do nothing and exit early!
			// But wait, what if the source map is missing because the `sourceMap` option was off?
			// We're going to assume that if the source map exists, it's in sync,
			// in the same way that we're assuming that the build file is in sync
			// when the cached source file hasn't changed.
			if (!this.sourceMap || (await pathExists(buildSourceMapId))) {
				// TODO what about pending compilations? I think that'd be a bug, we'd need to track the current compilations and throw away work that's not the most recent
				return;
			}
		}

		// compile!
		let output: CompiledOutput;
		try {
			// TODO doesn't handle multiple files for e.g. Svelte,
			// and we're going to have to check each file against the compilation
			// to avoid writing to disk like Svelte's CSS.
			// Can we share code or at least interfaces with gen files? That's compilation!
			output = await this.compileFile(id, sourceContents);
		} catch (err) {
			log.error(red('compileFile failed for'), printPath(id), printError(err));
			return;
		}

		const promises: Promise<void>[] = [];

		// Compare the compiled code with the cache
		if (buildPathInfo.contents !== output.code) {
			log.trace('writing compiled file to disk', printPath(buildId));
			buildPathInfo.contents = output.code;
			promises.push(outputFile(buildId, buildPathInfo.contents));
		}

		// Even if output code has not changed,
		// we still want to check the source map because it involves tricky corner cases.
		// Without this, there could be stale or missing source maps in the cache
		// when toggling source maps on and off.

		// `output.map === undefined` when `sourceMap === false`
		if (output.map === undefined) {
			const deletedSourceMap = pathInfoByBuildId.delete(buildSourceMapId);
			if (deletedSourceMap) {
				log.trace('deleting source map on disk', printPath(buildSourceMapId));
				promises.push(remove(buildSourceMapId));
			}
		} else {
			let shouldOutputSourceMap = true;
			let buildPathSourceMapInfo = pathInfoByBuildId.get(buildSourceMapId) as
				| FilePathInfo
				| undefined;
			if (!buildPathSourceMapInfo) {
				buildPathSourceMapInfo = {
					id: buildSourceMapId,
					isDirectory: false,
					contents: output.map,
				};
				pathInfoByBuildId.set(buildSourceMapId, buildPathSourceMapInfo);
				// TODO can we avoid this check through inference?
				// if the source map `pathExists` and we didn't `outputFile` for the build contents above, we could skip `readFile` I think
				if (
					(await pathExists(buildSourceMapId)) &&
					(await readFile(buildSourceMapId, 'utf8')) === output.map
				) {
					shouldOutputSourceMap = false;
				}
			} else if (buildPathSourceMapInfo.contents === output.map) {
				shouldOutputSourceMap = false;
			} else {
				buildPathSourceMapInfo.contents = output.map;
			}
			if (shouldOutputSourceMap) {
				log.trace('writing source map to disk', printPath(buildSourceMapId));
				promises.push(outputFile(buildSourceMapId, buildPathSourceMapInfo.contents));
			}
		}

		await Promise.all(promises);
	}

	private async destroySourceId(id: string): Promise<void> {
		this.log.trace('destroying file', printPath(id));
		this.pathInfoBySourceId.delete(id);
		const buildId = toBuildId(id);
		this.pathInfoByBuildId.delete(buildId);
		const sourceMapBuildId = buildId + SOURCE_MAP_EXTENSION;
		const deletedSourceMap = this.pathInfoByBuildId.delete(sourceMapBuildId);
		await Promise.all([remove(buildId), deletedSourceMap ? remove(sourceMapBuildId) : null]);
	}

	enqueuedWatcherChanges: [change: WatcherChange, path: string, stats: PathStats][] = [];
	private async flushEnqueuedWatcherChanges(): Promise<void> {
		for (const change of this.enqueuedWatcherChanges) {
			await this.onWatcherChange(...change);
		}
	}
}
