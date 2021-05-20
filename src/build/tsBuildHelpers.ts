import type {CompilerOptions} from 'typescript';

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

	const options: CompilerOptions = {
		...tsOptions,
		declaration: true,
		emitDeclarationOnly: true,
		isolatedModules: true, // already had this restriction with Svelte, so no fancy const enums
		noLib: true,
		noResolve: true,
	};
	const host = ts.createCompilerHost(options);
	host.writeFile = (_, data) => (result = data);
	host.getSourceFile = (fileName, target) => ts.createSourceFile(fileName, currentContents, target);
	return (id, contents) => {
		currentContents = contents;
		// if (!id.endsWith('src/build.task.ts')) return '//';
		const program = ts.createProgram([id], options, host);
		program.emit();
		return result;
	};
};
