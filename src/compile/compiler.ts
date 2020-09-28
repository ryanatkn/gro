import {toBuildId} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';

export interface Compiler<T extends Compilation = Compilation> {
	compile(source: CompilationSource): CompileResult<T> | Promise<CompileResult<T>>;
}

export interface CompileResult<T extends Compilation = Compilation> {
	compilations: T[];
}

export type Compilation = TextCompilation | BinaryCompilation;
export interface BaseCompilation {
	id: string;
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

export interface SelectCompiler {
	(source: CompilationSource): Compiler | null;
}

export interface Options {
	selectCompiler: SelectCompiler;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		selectCompiler: selectNoopCompiler,
		...omitUndefined(opts),
	};
};

export const createCompiler = (opts: InitialOptions = {}): Compiler => {
	const {selectCompiler} = initOptions(opts);

	const compile: Compiler['compile'] = (source: CompilationSource) => {
		const compiler = selectCompiler(source) || noopCompiler;
		return compiler.compile(source);
	};

	return {compile};
};

const createNoopCompiler = (): Compiler => {
	const compile: Compiler['compile'] = (source: CompilationSource) => {
		const buildId = toBuildId(source.id);
		let file: Compilation;
		switch (source.encoding) {
			case 'utf8':
				file = {
					id: buildId,
					extension: source.extension,
					encoding: source.encoding,
					contents: source.contents,
					sourceMapOf: null,
				};
				break;
			case null:
				file = {
					id: buildId,
					extension: source.extension,
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
export const selectNoopCompiler: SelectCompiler = () => noopCompiler;
