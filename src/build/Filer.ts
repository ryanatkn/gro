import {resolve, extname, join, basename, dirname} from 'path';
import lexer from 'es-module-lexer';

import {
	FilerDir,
	FilerDirChangeCallback,
	createFilerDir,
	CompilableFilerDir,
	NonCompilableInternalsFilerDir,
	CompilableInternalsFilerDir,
	ExternalsFilerDir,
} from '../build/FilerDir.js';
import {stat, Stats} from '../fs/nodeFs.js';
import {DEBOUNCE_DEFAULT} from '../fs/watchNodeFs.js';
import {
	EXTERNALS_DIR,
	hasSourceExtension,
	JS_EXTENSION,
	paths,
	SVELTE_EXTENSION,
	toBuildOutDir,
} from '../paths.js';
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
import {getMimeTypeByExtension} from '../fs/mime.js';
import {Encoding, inferEncoding} from '../fs/encoding.js';
import {replaceExtension} from '../utils/path.js';
import {BuildConfig} from './buildConfig.js';
import {stripEnd, stripStart} from '../utils/string.js';

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
	readonly buffer: Buffer;
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
}
export interface CompilableBinarySourceFile extends BinarySourceFile {
	readonly compilable: true;
	readonly filerDir: CompilableInternalsFilerDir;
	readonly compiledFiles: CompiledFile[];
}
export interface CompilableExternalsSourceFile extends ExternalsSourceFile {
	readonly compilable: true;
	readonly filerDir: ExternalsFilerDir;
	readonly compiledFiles: CompiledFile[];
}
export interface NonCompilableTextSourceFile extends TextSourceFile {
	readonly compilable: false;
	readonly filerDir: NonCompilableInternalsFilerDir;
	readonly compiledFiles: null;
}
export interface NonCompilableBinarySourceFile extends BinarySourceFile {
	readonly compilable: false;
	readonly filerDir: NonCompilableInternalsFilerDir;
	readonly compiledFiles: null;
}

export type CompiledFile = CompiledTextFile | CompiledBinaryFile;
export interface CompiledTextFile extends BaseCompiledFile {
	readonly compilation: TextCompilation;
	readonly encoding: 'utf8';
	readonly contents: string;
	readonly sourceMapOf: string | null; // TODO maybe prefer a union with an `isSourceMap` boolean flag?
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

export interface Options {
	dev: boolean;
	compiler: Compiler | null;
	compiledDirs: string[];
	externalsDir: string;
	servedDirs: ServedDir[];
	buildConfigs: BuildConfig[] | null;
	externalsBuildConfig: BuildConfig | null;
	buildRootDir: string;
	include: (id: string) => boolean;
	sourceMap: boolean;
	debounce: number;
	watch: boolean;
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
	const externalsDir = opts.externalsDir
		? resolve(opts.externalsDir)
		: `${buildRootDir}${EXTERNALS_DIR}`;
	validateDirs(compiledDirs, externalsDir, buildRootDir);
	const compiledDirCount = compiledDirs.length + externalsDir.length;
	// default to serving all of the compiled output files
	const servedDirs = toServedDirs(
		opts.servedDirs ||
			(buildConfigs === null
				? []
				: [
						toBuildOutDir(
							dev,
							(buildConfigs.find((c) => c.platform === 'browser') || buildConfigs[0]).name,
							'',
							buildRootDir,
						),
				  ]),
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
		debounce: DEBOUNCE_DEFAULT,
		watch: true,
		cleanOutputDirs: true,
		...omitUndefined(opts),
		include: opts.include || (() => true),
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
	private readonly servedDirs: ServedDir[];
	private readonly buildConfigs: BuildConfig[] | null;
	private readonly externalsBuildConfig: BuildConfig | null;
	private readonly buildRootDir: string;
	private readonly dev: boolean;
	private readonly sourceMap: boolean;
	private readonly log: Logger;
	private readonly cleanOutputDirs: boolean;
	private readonly include: (id: string) => boolean;

	private readonly files: Map<string, FilerFile> = new Map();
	private readonly dirs: FilerDir[];
	private readonly externalsDir: CompilableFilerDir;

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
			include,
			sourceMap,
			debounce,
			watch,
			cleanOutputDirs,
			log,
		} = initOptions(opts);
		this.dev = dev;
		this.buildConfigs = buildConfigs;
		this.externalsBuildConfig = externalsBuildConfig;
		this.buildRootDir = buildRootDir;
		this.servedDirs = servedDirs;
		this.include = include;
		this.sourceMap = sourceMap;
		this.cleanOutputDirs = cleanOutputDirs;
		this.log = log;
		this.dirs = createFilerDirs(
			compiledDirs,
			servedDirs,
			externalsDir,
			compiler,
			buildRootDir,
			watch,
			debounce,
			this.onDirChange,
		);
		this.externalsDir = this.dirs.find((d) => d.dir === externalsDir) as CompilableFilerDir;
	}

	// Searches for a file matching `path`, limited to the directories that are served.
	async findByPath(path: string): Promise<BaseFile | null> {
		// TODO this could be optimized (and avoid rare but weird false positives)
		// by making it detect "externals" at the beginning of the path and only search that served dir,
		// but the problem there is then "externals" becomes a reserved directory
		for (const servedDir of this.servedDirs) {
			const id = `${servedDir.servedAt}/${path}`;
			const file = this.files.get(id);
			if (file !== undefined) {
				return file;
			}
			// TODO should this be a source or compiled file?
			// `file.dirty`? `file.lazy`?
			// if (file.type === 'source' && file.dirty) {
			// TODO can this be cleaned up?
			if (id.startsWith(this.externalsDir.dir)) {
				const externalsDirBasePath = stripStart(this.externalsDir.dir, this.buildRootDir);
				const sourceId = stripEnd(stripStart(path, `${externalsDirBasePath}/`), JS_EXTENSION);
				if (await this.updateSourceFile(sourceId, this.externalsDir)) {
					await this.compileSourceId(sourceId, this.externalsDir);
				}
				const compiledFile = this.files.get(id);
				if (!compiledFile) {
					// TODO check dirty flag? here and above? what about lazy?
					throw Error('Expected to compile file');
				}
				return compiledFile;
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

		await Promise.all([Promise.all(this.dirs.map((d) => d.init())), lexer.init]);

		const {buildConfigs} = this;
		if (this.cleanOutputDirs && buildConfigs !== null) {
			// Clean the dev output directories,
			// removing any files that can't be mapped back to source files.
			// For now, this does not handle production output.
			// See the comments where `dev` is declared for more.
			// (more accurately, it could handle prod, but not simultaneous to dev)
			const buildOutDirs: string[] = buildConfigs.map((buildConfig) =>
				toBuildOutDir(this.dev, buildConfig.name, '', this.buildRootDir),
			);
			await Promise.all(
				buildOutDirs.map(async (outputDir) => {
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
					if (
						(await this.updateSourceFile(id, filerDir)) &&
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
								remove(toBuildOutDir(this.dev, buildConfig.name, change.path, this.buildRootDir)),
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

	// Returns a boolean indicating if the source file changed.
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
		// TODO hack
		const newSourceContents =
			filerDir.type === 'externals'
				? 'TODO read package.json and put the version here, probably'
				: await loadContents(encoding, id);

		let newSourceFile: SourceFile;
		if (sourceFile === undefined) {
			// Memory cache is cold.
			// TODO add hash caching to avoid this work when not needed
			// (base on source id hash comparison combined with compile options diffing like sourcemaps and ES target)
			newSourceFile = createSourceFile(id, encoding, extension, newSourceContents, filerDir);
		} else if (
			areContentsEqual(encoding, sourceFile.contents, newSourceContents) &&
			// TODO hack to avoid the comparison for externals because they're compiled lazily
			!(filerDir.type === 'externals' && sourceFile.compiledFiles?.length === 0)
		) {
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
	private enqueuedCompilations: Map<string, [string, CompilableFilerDir]> = new Map();

	// This wrapper function protects against race conditions
	// that could occur with concurrent compilations.
	// If a file is currently being compiled, it enqueues the file id,
	// and when the current compilation finishes,
	// it removes the item from the queue and recompiles the file.
	// The queue stores at most one compilation per file,
	// and this is safe given that compiling accepts no parameters.
	private async compileSourceId(id: string, filerDir: CompilableFilerDir): Promise<void> {
		if (!this.include(id)) {
			return;
		}
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
			if (await this.updateSourceFile(...enqueuedCompilation)) {
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
		const buildConfigs: BuildConfig[] =
			sourceFile.filerDir.type === 'externals' ? [this.externalsBuildConfig!] : this.buildConfigs!;
		const results = await Promise.all(
			buildConfigs.map((buildConfig) =>
				sourceFile.filerDir.compiler.compile(sourceFile, buildConfig, this.buildRootDir, this.dev),
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
								mimeType: undefined,
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
								mimeType: undefined,
								buffer: compilation.contents,
							};
						default:
							throw new UnreachableError(compilation);
					}
				},
			),
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
			if (moduleName === 'import.meta') continue;
			let newModuleName = moduleName;
			if (moduleName.endsWith(SVELTE_EXTENSION)) {
				newModuleName = replaceExtension(moduleName, JS_EXTENSION);
			}
			if (compilation.buildConfig.platform === 'browser' && isExternalModule(moduleName)) {
				newModuleName = `/${EXTERNALS_DIR}/${newModuleName}`;
				if (!newModuleName.endsWith(JS_EXTENSION)) {
					newModuleName += JS_EXTENSION;
				}
			}
			if (newModuleName !== moduleName) {
				result += contents.substring(index, start) + newModuleName;
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

const INTERNAL_MODULE_MATCHER = /^\.?\.?\//;
const isExternalModule = (moduleName: string): boolean => !INTERNAL_MODULE_MATCHER.test(moduleName);

// TODO Revisit these restrictions - the goal right now is to set limits
// to avoid undefined behavior at the cost of flexibility.
// Some of these conditions like nested compiledDirs could be fixed
// but there are inefficiencies and possibly some subtle bugs.
const validateDirs = (compiledDirs: string[], externalsDir: string, buildRootDir: string) => {
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
		if (compiledDir.startsWith(externalsDir)) {
			throw Error(
				'A compiledDir cannot be inside the externalsDir: ' +
					`${compiledDir} is inside ${externalsDir}`,
			);
		}
	}
	if (!externalsDir.startsWith(buildRootDir)) {
		throw Error(
			'The externalsDir must be located inside the buildRootDir: ' +
				`${externalsDir} is not inside ${buildRootDir}`,
		);
	}
	const nestedCompiledDir = compiledDirs.find((d) => externalsDir.startsWith(d));
	if (nestedCompiledDir) {
		throw Error(
			'The externalsDir cannot be inside a compiledDir: ' +
				`${externalsDir} is inside ${nestedCompiledDir}`,
		);
	}
};

// This code could be shortened a lot by collapsing the object declarations,
// but as is it doesn't play nicely with the types, and it might be harder to reason about.
const createSourceFile = (
	id: string,
	encoding: Encoding,
	extension: string,
	newSourceContents: string | Buffer,
	filerDir: FilerDir,
): SourceFile => {
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
			id,
			filename,
			dir,
			dirBasePath,
			extension,
			encoding,
			contents: newSourceContents as string,
			filerDir,
			compiledFiles: [],
			stats: undefined,
			mimeType: undefined,
			buffer: undefined,
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
						compilable: true,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: newSourceContents as string,
						filerDir,
						compiledFiles: [],
						stats: undefined,
						mimeType: undefined,
						buffer: undefined,
				  }
				: {
						type: 'source',
						sourceType: 'text',
						compilable: false,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: newSourceContents as string,
						filerDir,
						compiledFiles: null,
						stats: undefined,
						mimeType: undefined,
						buffer: undefined,
				  };
		case null:
			return filerDir.compilable
				? {
						type: 'source',
						sourceType: 'binary',
						compilable: true,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: newSourceContents as Buffer,
						filerDir,
						compiledFiles: [],
						stats: undefined,
						mimeType: undefined,
						buffer: newSourceContents as Buffer,
				  }
				: {
						type: 'source',
						sourceType: 'binary',
						compilable: false,
						id,
						filename,
						dir,
						dirBasePath,
						extension,
						encoding,
						contents: newSourceContents as Buffer,
						filerDir,
						compiledFiles: null,
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
const createFilerDirs = (
	compiledDirs: string[],
	servedDirs: ServedDir[],
	externalsDir: string,
	compiler: Compiler | null,
	buildRootDir: string,
	watch: boolean,
	debounce: number,
	onChange: FilerDirChangeCallback,
): FilerDir[] => {
	const dirs: FilerDir[] = [];
	for (const compiledDir of compiledDirs) {
		dirs.push(createFilerDir(compiledDir, 'files', compiler, watch, debounce, onChange));
	}
	dirs.push(createFilerDir(externalsDir, 'externals', compiler, false, debounce, onChange));
	// TODO should these be ignored in watch mode, or might some code want to query the cache?
	if (watch) {
		for (const servedDir of servedDirs) {
			// If a `servedDir` is inside a compiled or externals directory,
			// it's already in the Filer's memory cache and does not need to be loaded as a directory.
			// Additionally, the same is true for `servedDir`s that are inside other `servedDir`s.
			if (
				!compiledDirs.find((d) => servedDir.dir.startsWith(d)) &&
				!servedDir.dir.startsWith(externalsDir) &&
				!servedDirs.find((d) => d !== servedDir && servedDir.dir.startsWith(d.dir)) &&
				!servedDir.dir.startsWith(buildRootDir)
			) {
				dirs.push(createFilerDir(servedDir.dir, 'files', null, watch, debounce, onChange));
			}
		}
	}
	return dirs;
};

interface ServedDir {
	dir: string; // TODO rename? `source`, `sourceDir`, `path`
	servedAt: string; // TODO rename?
}
type ServedDirPartial = string | PartialExcept<ServedDir, 'dir'>;
const toServedDirs = (partials: ServedDirPartial[]): ServedDir[] => {
	const dirs = partials.map((d) => toServedDir(d));
	const uniqueDirs = new Set<string>();
	for (const dir of dirs) {
		// TODO instead of the error, should we allow multiple served paths for each input dir?
		// This is mainly done to prevent duplicate work in watching the source directories.
		if (uniqueDirs.has(dir.dir)) {
			throw Error(`Duplicate servedDirs are not allowed: ${dir.dir}`);
		}
		uniqueDirs.add(dir.dir);
	}
	return dirs;
};
const toServedDir = (dir: ServedDirPartial): ServedDir => {
	if (typeof dir === 'string') dir = {dir};
	const resolvedDir = resolve(dir.dir);
	return {
		dir: resolvedDir,
		servedAt: dir.servedAt ? resolve(dir.servedAt) : resolvedDir,
	};
};
