import {readFileSync} from 'fs';
import type {CompilerOptions} from 'typescript';
import {isSourceId, TS_DEFS_EXTENSION, TS_EXTENSION} from '../paths.js';
import {EMPTY_OBJECT} from '../utils/object.js';
import {printPath} from '../utils/print.js';
import {stripEnd} from '../utils/string.js';
import type {BuildContext} from './builder.js';

/*

This uses the TypeScript compiler to generate types.

There's a mismatch with the current usage versus Gro's systems;
Gro builds files as individual units (minus the externals builder, see below),
but I'm unable to find a compiler API that makes it straightforward and efficient
to output a single file's type definitions.
What I want may simply be impossible because of how the type system works.

This problem manifests as builds taking around 10x longer than they should.

It would be possible and efficient to generate types outside of Gro's normal build system,
but right now I don't like those implications long term.
Instead, I think there's a better design for Gro here,
to expand its view of the world beyond individual files,
which would also address the currently hacky implementation of the externals builder.

These two use cases - externals and types - should be able to inform a better design.

*/

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

export const toGenerateTypes = async (
	{log, findById}: BuildContext,
	tsOptions: CompilerOptions = EMPTY_OBJECT,
): Promise<GenerateTypes> => {
	// We're lazily importing the TypeScript compiler because this module is loaded eagerly,
	// but `toGenerateTypes` is only called in some circumstances at runtime. (like prod builds)
	const ts = (await import('typescript')).default;

	// This is safe because the returned function below is synchronous
	let result: string;
	const results: Map<string, string> = new Map();
	let currentContents: string;
	let currentId: string;

	const options: CompilerOptions = {
		...tsOptions,
		declaration: true,
		emitDeclarationOnly: true,
		isolatedModules: true, // already had this restriction with Svelte, so no fancy const enums
		// noResolve: true, // TODO doesn't generate the types correctly, but it makes it build fast!
		skipLibCheck: true,
	};

	const host = ts.createCompilerHost(options);
	host.writeFile = (fileName, data) => {
		if (!fileName.endsWith(TS_DEFS_EXTENSION)) throw Error('TODO');
		const fileNameTs = stripEnd(fileName, TS_DEFS_EXTENSION) + TS_EXTENSION;
		if (fileNameTs === currentId) {
			result = data;
		}
		results.set(fileNameTs, data);
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
		if (results.has(id)) return results.get(id)!;
		log.trace('generating types', printPath(id));
		result = '';
		currentId = id;
		currentContents = contents;
		const program = ts.createProgram([id], options, host);
		program.emit();
		return result;
	};
};
