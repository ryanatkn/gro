// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';

import {CSS_EXTENSION, JS_EXTENSION, SVELTE_EXTENSION} from '../paths.js';
import type {
	TextCompilation,
	BinaryCompilation,
	Compilation,
	CompileOptions,
	CompileResult,
	CompilationSource,
} from '../compile/compiler.js';
import {replaceExtension} from '../utils/path.js';
import {stripStart} from '../utils/string.js';

const INTERNAL_MODULE_MATCHER = /^\.?\.?\//;
const isExternalModule = (moduleName: string): boolean => !INTERNAL_MODULE_MATCHER.test(moduleName);

export function postprocess(
	compilation: TextCompilation,
	options: CompileOptions,
	result: CompileResult<Compilation>,
	source: CompilationSource,
): string;
export function postprocess(
	compilation: BinaryCompilation,
	options: CompileOptions,
	result: CompileResult<Compilation>,
	source: CompilationSource,
): Buffer;
export function postprocess(
	compilation: Compilation,
	{externalsDirBasePath, servedDirs}: CompileOptions,
	result: CompileResult<Compilation>,
	source: CompilationSource,
) {
	if (compilation.encoding === 'utf8') {
		let {contents} = compilation;

		// Map import paths to the compiled versions.
		if (compilation.extension === JS_EXTENSION) {
			let result = '';
			let index = 0;
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
				if (
					externalsDirBasePath !== null &&
					compilation.buildConfig.platform === 'browser' &&
					isExternalModule(moduleName)
				) {
					newModuleName = `/${externalsDirBasePath}/${newModuleName}${JS_EXTENSION}`;
				}
				if (newModuleName !== moduleName) {
					result += contents.substring(index, start) + newModuleName;
					index = end;
				}
			}
			if (index > 0) {
				contents = result + contents.substring(index);
			}
		}

		// Support Svelte CSS for development.
		if (source.extension === SVELTE_EXTENSION && compilation.extension === JS_EXTENSION) {
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
		return contents;
	} else {
		// Handle other encodings like binary.
		return compilation.contents;
	}
}

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
