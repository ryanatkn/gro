import {join} from 'path';
// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';

import {
	CSS_EXTENSION,
	EXTERNALS_BUILD_DIR,
	JS_EXTENSION,
	SVELTE_EXTENSION,
	toBuildExtension,
	toBuildOutPath,
} from '../paths.js';
import type {Build, BuildOptions, BuildResult, BuildSource} from './builder.js';
import {stripStart} from '../utils/string.js';
import {isExternalBrowserModule, isExternalNodeModule} from '../utils/module.js';

// TODO this is all hacky and should be refactored

export const postprocess = (
	build: Build,
	{servedDirs, buildRootDir, dev}: BuildOptions,
	result: BuildResult<Build>,
	source: BuildSource,
): {contents: Build['contents']; dependencies: Set<string> | null} => {
	if (build.encoding === 'utf8') {
		let {contents, buildConfig} = build;
		const isBrowser = buildConfig.platform === 'browser';
		let dependencies: Set<string> | null = null;

		// Map import paths to the built versions.
		if (build.extension === JS_EXTENSION) {
			const isExternalModule = isBrowser ? isExternalBrowserModule : isExternalNodeModule;
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
				let dependency: string;
				const isExternalImport = isExternalModule(moduleName);
				if (isExternalImport) {
					if (isBrowser) {
						// TODO might want to use this `esinstall` helper: https://github.com/snowpackjs/snowpack/blob/a09bba81d01fa7b3769024f9bd5adf0d3fc4bafc/esinstall/src/util.ts#L161
						// I'd prefer to add the `.js` always, but esinstall seems to force this
						newModuleName = `/${EXTERNALS_BUILD_DIR}/${newModuleName}${
							newModuleName.endsWith(JS_EXTENSION) ? '' : JS_EXTENSION
						}`;
						dependency = toBuildOutPath(
							dev,
							buildConfig.name,
							newModuleName.substring(1),
							buildRootDir,
						);
					} else {
						dependency = newModuleName;
					}
				} else {
					dependency = join(build.dir, newModuleName);
				}
				(dependencies || (dependencies = new Set())).add(dependency);
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
		if (source.extension === SVELTE_EXTENSION && build.extension === JS_EXTENSION && isBrowser) {
			const cssCompilation = result.builds.find((c) => c.extension === CSS_EXTENSION);
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
		return {contents, dependencies};
	} else {
		// Handle other encodings like binary.
		return {contents: build.contents, dependencies: null};
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
