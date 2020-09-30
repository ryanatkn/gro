import {join} from 'path';

import {omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';

export interface Compiler<T extends Compilation = Compilation> {
	compile(source: CompilationSource, outDir: string): CompileResult<T> | Promise<CompileResult<T>>;
}

export interface CompileResult<T extends Compilation = Compilation> {
	compilations: T[];
}

export type Compilation = TextCompilation | BinaryCompilation;
export interface BaseCompilation {
	id: string;
	filename: string;
	dir: string;
	extension: string;
}
export interface TextCompilation extends BaseCompilation {
	encoding: 'utf8';
	contents: string;
	sourceMapOf: string | null; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
}
export interface BinaryCompilation extends BaseCompilation {
	encoding: null;
	contents: Buffer;
}

export type CompilationSource = TextCompilationSource | BinaryCompilationSource;
interface BaseCompilationSource {
	id: string;
	filename: string;
	dir: string;
	extension: string;
}
export interface TextCompilationSource extends BaseCompilationSource {
	encoding: 'utf8';
	contents: string;
}
export interface BinaryCompilationSource extends BaseCompilationSource {
	encoding: null;
	contents: Buffer;
}

export interface GetCompiler {
	(source: CompilationSource, outDir: string): Compiler | null;
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

	const compile: Compiler['compile'] = (source: CompilationSource, outDir: string) => {
		const compiler = getCompiler(source, outDir) || noopCompiler;
		return compiler.compile(source, outDir);
	};

	return {compile};
};

const createNoopCompiler = (): Compiler => {
	const compile: Compiler['compile'] = (source: CompilationSource, outDir: string) => {
		const {filename, extension} = source;
		const id = join(outDir, filename); // TODO this is broken, needs to account for dirs
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
				};
				break;
			default:
				throw new UnreachableError(source);
		}
		return {compilations: [file]};
	};
	return {compile};
};
export const noopCompiler = createNoopCompiler();
export const getNoopCompiler: GetCompiler = () => noopCompiler;
