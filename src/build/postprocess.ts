// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';

import {JS_EXTENSION, SVELTE_EXTENSION} from '../paths.js';
import type {
	TextCompilation,
	BinaryCompilation,
	Compilation,
	CompileOptions,
} from '../compile/compiler.js';
import {replaceExtension} from '../utils/path.js';

const INTERNAL_MODULE_MATCHER = /^\.?\.?\//;
const isExternalModule = (moduleName: string): boolean => !INTERNAL_MODULE_MATCHER.test(moduleName);

export function postprocess(compilation: TextCompilation, options: CompileOptions): string;
export function postprocess(compilation: BinaryCompilation, options: CompileOptions): Buffer;
export function postprocess(compilation: Compilation, {externalsDirBasePath}: CompileOptions) {
	if (compilation.encoding === 'utf8' && compilation.extension === JS_EXTENSION) {
		let result = '';
		let index = 0;
		const {contents} = compilation;
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
			return result + contents.substring(index);
		} else {
			return contents;
		}
	}
	return compilation.contents;
}
