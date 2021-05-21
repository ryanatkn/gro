import {readFileSync} from 'fs';
import type {CompilerOptions} from 'typescript';
// import type typescript from 'typescript';
// import {paths} from '../paths.js';

// TODO I'm about to give up here
// maybe we just use tsc on the entire project,
// compile to a temporary directory, and then just change this to
// ensure the process has been run once, and then just read from the fs?

import {EMPTY_OBJECT} from '../utils/object.js';

export type EcmaScriptTarget =
	| 'es3'
	| 'es5'
	| 'es2015'
	| 'es2016'
	| 'es2017'
	| 'es2018'
	| 'es2019'
	| 'es2020'
	| 'esnext';

export interface GenerateTypes {
	(id: string, contents: string): string;
}

// TODO optimize, this is unusably slow for some reason
// - is there a faster path in the TypeScript compiler API for generating types?
// - maybe queue these calls instead of calling concurrently
export const toGenerateTypes = async (
	tsOptions: CompilerOptions = EMPTY_OBJECT,
): Promise<GenerateTypes> => {
	// We're lazily importing the TypeScript compiler because this module is loaded eagerly,
	// but `toGenerateTypes` is only called in some circumstances at runtime. (like prod builds)
	const ts = (await import('typescript')).default;

	// This is safe because the returned function below is synchronous
	let result: string;
	let currentContents: string;
	let currentId: string;

	const options: CompilerOptions = {
		...tsOptions,
		declaration: true,
		emitDeclarationOnly: true,
		isolatedModules: true, // already had this restriction with Svelte, so no fancy const enums
		// noLib: true, // TODO
		// noResolve: true, // TODO
		skipLibCheck: true,
	};

	// // memory impl of `ts.createCompilerHost(options)`
	// const toCompilerHost = (ts: typeof typescript): CompilerHost => ({
	// 	getSourceFile: (fileName, target) => ts.createSourceFile(fileName, currentContents, target),
	// 	getDefaultLibLocation: () => paths.root,
	// 	getDefaultLibFileName: () => 'lib.d.ts',
	// 	writeFile: (_, data) => (result = data),
	// 	getCurrentDirectory: () => paths.root,
	// 	useCaseSensitiveFileNames: () => true,
	// 	getCanonicalFileName: (filename) => filename,
	// 	getNewLine: () => '\n',
	// 	fileExists: () => true, // the build system does this for us, no need to hit the filesystem
	// 	readFile: () => '',
	// });

	// const host = toCompilerHost(ts);
	const host = ts.createCompilerHost(options);
	host.writeFile = (fileName, data) => {
		if (
			fileName.substring(0, fileName.length - 4) === currentId.substring(0, currentId.length - 2)
		) {
			result = data;
		}
		// else {
		// 	// TODO how to cache this without staleness?
		// }
	};
	host.readFile = (fileName) => {
		if (fileName === currentId) {
			console.log('fileName, currentId', fileName, currentId);
			return currentContents;
		}
		// TODO lookup from memory.. but externals?
		return readFileSync(fileName, 'utf8');
	};

	return (id, contents) => {
		result = '';
		currentId = id;
		currentContents = contents;
		const program = ts.createProgram([id], options, host);
		program.emit();
		return result;
	};
};
