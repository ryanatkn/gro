import {omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {BuildConfig} from '../config/buildConfig.js';
import {toBuildOutPath} from '../paths.js';
import {EcmaScriptTarget} from './tsBuildHelpers.js';
import {ServedDir} from '../build/ServedDir.js';

export interface Compiler<
	TSource extends CompilationSource = CompilationSource,
	TCompilation extends Compilation = Compilation
> {
	compile(
		source: TSource,
		buildConfig: BuildConfig,
		options: CompileOptions,
	): CompileResult<TCompilation> | Promise<CompileResult<TCompilation>>;
}

export interface CompileResult<TCompilation extends Compilation = Compilation> {
	compilations: TCompilation[];
}
export interface CompileOptions {
	readonly sourceMap: boolean;
	readonly target: EcmaScriptTarget;
	readonly buildRootDir: string;
	readonly dev: boolean;
	readonly externalsDirBasePath: string | null;
	readonly servedDirs: readonly ServedDir[];
}

export type Compilation = TextCompilation | BinaryCompilation;
export interface TextCompilation extends BaseCompilation {
	encoding: 'utf8';
	contents: string;
	sourceMapOf: string | null; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
}
export interface BinaryCompilation extends BaseCompilation {
	encoding: null;
	contents: Buffer;
}
interface BaseCompilation {
	id: string;
	filename: string;
	dir: string;
	extension: string;
	buildConfig: BuildConfig;
}

export type CompilationSource =
	| TextCompilationSource
	| BinaryCompilationSource
	| ExternalsCompilationSource;
export interface TextCompilationSource extends BaseCompilationSource {
	sourceType: 'text';
	encoding: 'utf8';
	contents: string;
}
export interface BinaryCompilationSource extends BaseCompilationSource {
	sourceType: 'binary';
	encoding: null;
	contents: Buffer;
}
export interface ExternalsCompilationSource extends BaseCompilationSource {
	sourceType: 'externals';
	encoding: 'utf8';
	contents: string;
}
interface BaseCompilationSource {
	id: string;
	filename: string;
	dir: string;
	dirBasePath: string;
	extension: string;
}

export interface GetCompiler {
	(source: CompilationSource, buildConfig: BuildConfig): Compiler | null;
}

export interface Options {
	getCompiler: GetCompiler;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		getCompiler: getNoopCompiler,
		...omitUndefined(opts),
	};
};

export const createCompiler = (opts: InitialOptions = {}): Compiler => {
	const {getCompiler} = initOptions(opts);

	const compile: Compiler['compile'] = (
		source: CompilationSource,
		buildConfig: BuildConfig,
		options: CompileOptions,
	) => {
		const compiler = getCompiler(source, buildConfig) || noopCompiler;
		return compiler.compile(source, buildConfig, options);
	};

	return {compile};
};

const noopCompiler: Compiler = {
	compile: (source, buildConfig, {buildRootDir, dev}) => {
		const {filename, extension} = source;
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildRootDir);
		const id = `${outDir}${filename}`;
		let file: Compilation;
		switch (source.encoding) {
			case 'utf8':
				file = {
					id,
					filename,
					dir: outDir,
					extension,
					encoding: source.encoding,
					contents: source.contents,
					sourceMapOf: null,
					buildConfig,
				};
				break;
			case null:
				file = {
					id,
					filename,
					dir: outDir,
					extension,
					encoding: source.encoding,
					contents: source.contents,
					buildConfig,
				};
				break;
			default:
				throw new UnreachableError(source);
		}
		return {compilations: [file]};
	},
};
const getNoopCompiler: GetCompiler = () => noopCompiler;
