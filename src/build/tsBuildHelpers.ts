import {readFileSync} from 'fs';
import type {CompilerOptions} from 'typescript';
import {isSourceId, TS_DEFS_EXTENSION, TS_EXTENSION} from '../paths.js';
import {EMPTY_OBJECT} from '../utils/object.js';
import {printPath} from '../utils/print.js';
import {stripEnd} from '../utils/string.js';
import type {Obj} from '../utils/types.js';
import type {BuildContext} from './builder.js';

// TODO I'm about to give up here
// maybe we just use tsc on the entire project,
// compile to a temporary directory, and then just change this to
// ensure the process has been run once, and then just read from the fs?

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
	{log, findById}: BuildContext,
	tsOptions: CompilerOptions = EMPTY_OBJECT,
): Promise<GenerateTypes> => {
	// We're lazily importing the TypeScript compiler because this module is loaded eagerly,
	// but `toGenerateTypes` is only called in some circumstances at runtime. (like prod builds)
	const ts = (await import('typescript')).default;

	// This is safe because the returned function below is synchronous
	let result: string;
	const results: Obj<string> = {};
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
	// 	fileExists: () => true,
	// 	readFile: () => '',
	// });

	// const host = toCompilerHost(ts);
	const host = ts.createCompilerHost(options);
	host.writeFile = (fileName, data) => {
		if (!fileName.endsWith(TS_DEFS_EXTENSION)) throw Error('TODO');
		const fileNameTs = stripEnd(fileName, TS_DEFS_EXTENSION) + TS_EXTENSION;
		if (fileNameTs === currentId) {
			result = data;
		}
		results[fileNameTs] = data;
	};
	host.readFile = (fileName) => {
		if (fileName === currentId) {
			return currentContents;
		} else if (isSourceId(fileName)) {
			return findById(fileName)!.contents as string;
		} else {
			// TODO externals - this is a problem because it's synchronous, can't use portable `fs.readFile`
			return readFileSync(fileName, 'utf8');
		}
	};

	return (id, contents) => {
		if (id in results) return results[id];
		log.info('generating types', printPath(id));
		result = '';
		currentId = id;
		currentContents = contents;
		const program = ts.createProgram([id], options, host);
		program.emit();
		return result;
	};
};
