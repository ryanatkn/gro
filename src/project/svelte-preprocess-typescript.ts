import ts from 'typescript';
import {PreprocessorGroup} from 'svelte/types/compiler/preprocess';

import {magenta, red} from '../colors/terminal.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {loadTsconfig} from '../build/tsBuildHelpers.js';
import {printPath} from '../utils/print.js';
import {omitUndefined} from '../utils/object.js';

/*

This module is no longer used, instead see `svelte-preprocess-esbuild`.
It may be used in the future for generating type mappings in production.

This preprocessor transpiles the script portion of Svelte files
if the script tag has a `lang="ts"` attribute.
No typechecking is performed - that's left for a separate build step.

*/

export interface Options {
	langs: string[];
	tsconfigPath: string | undefined;
	basePath: string | undefined;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => ({
	langs: ['ts'],
	tsconfigPath: undefined,
	basePath: undefined,
	...omitUndefined(opts),
});

const name = 'svelte-preprocess-typescript';

export const sveltePreprocessTypescript = (opts: InitialOptions = {}): PreprocessorGroup => {
	const {langs, tsconfigPath, basePath} = initOptions(opts);

	const log = new SystemLogger([magenta(`[${name}]`)]);

	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);

	return {
		script({content, attributes, filename}) {
			if (!langs.includes(attributes.lang as any)) return null as any; // type is wrong
			// log.info('transpiling', printPath(filename || ''));
			const transpileOptions: ts.TranspileOptions = {
				compilerOptions: tsconfig.compilerOptions,
				fileName: filename,
				// reportDiagnostics?: boolean;
				// moduleName?: string;
				// renamedDependencies?: MapLike<string>;
				transformers: customTransformersForTranspile(log),
			};
			let transpileOutput;
			try {
				transpileOutput = ts.transpileModule(content, transpileOptions);
			} catch (err) {
				log.error(red('Failed to transpile TypeScript'), printPath(filename || ''));
				throw err;
			}
			// TODO sourcemap - does Svelte need to add support for preprocessor sourcemaps?
			const {outputText /* diagnostics, sourceMapText */} = transpileOutput;
			// trace('outputText', outputText);
			return {code: outputText};
		},
	};
};

// These have the suffix `ForTranspile` to emphasize there's no typechecking.
const customTransformersForTranspile = (log: Logger): ts.CustomTransformers => ({
	before: [importTransformerForTranspile(log)],
});

const importTransformerForTranspile: (
	_log: Logger,
) => ts.TransformerFactory<ts.SourceFile> = () => (context) => {
	const visit: ts.Visitor = (node) => {
		if (ts.isImportDeclaration(node)) {
			// TODO this preserves all imports, but I don't fully understand how it works,
			// or if it should be done differently
			// console.log('module specifier', node.moduleSpecifier.getText());
			const result = ts.createImportDeclaration(
				node.decorators,
				node.modifiers,
				node.importClause,
				node.moduleSpecifier,
			);
			// console.log('VISIT result', result);
			return result;
		}
		return ts.visitEachChild(node, (child) => visit(child), context);
	};
	return (node) => ts.visitNode(node, visit);
};
