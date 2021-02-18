import {join} from 'path';
// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';

import {CSS_EXTENSION, JS_EXTENSION, SVELTE_EXTENSION, toBuildExtension} from '../paths.js';
import type {Build, BuildOptions, BuildResult, BuildSource} from './builder.js';
import {stripStart} from '../utils/string.js';
import {isExternalBrowserModule, isExternalNodeModule} from '../utils/module.js';

export const postprocess = (
	build: Build,
	{externalsDirBasePath, servedDirs}: BuildOptions,
	result: BuildResult<Build>,
	source: BuildSource,
): [
	contents: Build['contents'],
	localDependencies: Set<string> | null,
	externalDependencies: Set<string> | null,
] => {
	if (build.encoding === 'utf8') {
		let {contents} = build;
		let localDependencies: Set<string> | null = null;
		let externalDependencies: Set<string> | null = null;

		// Map import paths to the built versions.
		if (build.extension === JS_EXTENSION) {
			const isExternalModule =
				build.buildConfig.platform === 'browser' ? isExternalBrowserModule : isExternalNodeModule;
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
				if (isExternal && build.buildConfig.platform === 'browser') {
					// TODO it's weird that this is a fake absolute path while locals have real absolute paths
					// TODO might want to use this `esinstall` helper: https://github.com/snowpackjs/snowpack/blob/a09bba81d01fa7b3769024f9bd5adf0d3fc4bafc/esinstall/src/util.ts#L161
					newModuleName = `/${externalsDirBasePath}/${newModuleName}${
						newModuleName.endsWith(JS_EXTENSION) ? '' : JS_EXTENSION
					}`;
				}
				if (isExternal) {
					(externalDependencies || (externalDependencies = new Set())).add(newModuleName);
				} else {
					(localDependencies || (localDependencies = new Set())).add(
						join(build.dir, newModuleName),
					);
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
			build.extension === JS_EXTENSION &&
			build.buildConfig.platform === 'browser'
		) {
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
		return [contents, localDependencies, externalDependencies];
	} else {
		// Handle other encodings like binary.
		return [build.contents, null, null];
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
