import {join} from 'path';
// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';

import {CSS_EXTENSION, JS_EXTENSION, SVELTE_EXTENSION, toBuildExtension} from '../paths.js';
import type {
	Compilation,
	CompileOptions,
	CompileResult,
	CompilationSource,
} from '../compile/compiler.js';
import {stripStart} from '../utils/string.js';
import {isExternalBrowserModule, isExternalNodeModule} from '../utils/module.js';
import {EMPTY_ARRAY} from '../utils/array.js';

export const postprocess = (
	compilation: Compilation,
	{externalsDirBasePath, servedDirs}: CompileOptions,
	result: CompileResult<Compilation>,
	source: CompilationSource,
): [contents: Compilation['contents'], locals: string[], externals: string[]] => {
	if (compilation.encoding === 'utf8') {
		let {contents} = compilation;
		let locals: string[] | null = null;
		let externals: string[] | null = null;

		// Map import paths to the compiled versions.
		if (compilation.extension === JS_EXTENSION) {
			const isExternalModule =
				compilation.buildConfig.platform === 'browser'
					? isExternalBrowserModule
					: isExternalNodeModule;
			let transformedContents = '';
			let index = 0;
			// TODO what should we pass as the second arg to parse? the id? nothing? `lexer.parse(code, id);`
			const [imports] = lexer.parse(contents);
			for (const {s, e, d} of imports) {
				const start = d > -1 ? s + 1 : s;
				const end = d > -1 ? e - 1 : e;
				const moduleName = contents.substring(start, end);
				if (moduleName === 'import.meta') continue;
				let newModuleName = toBuildExtension(moduleName);
				const isExternal = isExternalModule(moduleName);
				if (
					isExternal &&
					externalsDirBasePath !== null &&
					compilation.buildConfig.platform === 'browser'
				) {
					newModuleName = `/${externalsDirBasePath}/${newModuleName}${JS_EXTENSION}`;
				}
				if (isExternal) {
					(externals || (externals = [])).push(newModuleName);
				} else {
					(locals || (locals = [])).push(join(compilation.dir, newModuleName));
				}
				if (newModuleName !== moduleName) {
					transformedContents += contents.substring(index, start) + newModuleName;
					index = end;
				}
			}
			if (index > 0) {
				contents = transformedContents + contents.substring(index);
			}
		}

		// Support Svelte CSS for development in the browser.
		if (
			source.extension === SVELTE_EXTENSION &&
			compilation.extension === JS_EXTENSION &&
			compilation.buildConfig.platform === 'browser'
		) {
			const cssCompilation = result.compilations.find((c) => c.extension === CSS_EXTENSION);
			if (cssCompilation !== undefined) {
				let importPath: string | undefined;
				for (const servedDir of servedDirs) {
					if (cssCompilation.id.startsWith(servedDir.dir)) {
						importPath = stripStart(cssCompilation.id, servedDir.servedAt);
						break;
					}
				}
				if (importPath !== undefined) {
					contents = injectSvelteCssImport(contents, importPath);
				}
			}
		}
		return [contents, locals || EMPTY_ARRAY, externals || EMPTY_ARRAY];
	} else {
		// Handle other encodings like binary.
		return [compilation.contents, EMPTY_ARRAY, EMPTY_ARRAY];
	}
};

const injectSvelteCssImport = (contents: string, importPath: string): string => {
	let newlineIndex = contents.length;
	for (let i = 0; i < contents.length; i++) {
		if (contents[i] === '\n') {
			newlineIndex = i;
			break;
		}
	}
	const injectedCssLoaderScript = `;globalThis.gro.registerCss('${importPath}');`; // account for barbaric semicolonness code
	const newContents = `${contents.substring(
		0,
		newlineIndex,
	)}${injectedCssLoaderScript}${contents.substring(newlineIndex)}`;
	return newContents;
};
