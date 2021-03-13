import {join} from 'path';
// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';

import {
	CSS_EXTENSION,
	EXTERNALS_BUILD_DIR,
	JS_EXTENSION,
	SVELTE_EXTENSION,
	toBuildBasePath,
	toBuildExtension,
	toBuildOutPath,
} from '../paths.js';
import type {Build, BuildContext, BuildResult, BuildSource, BuildDependency} from './builder.js';
import {stripStart} from '../utils/string.js';
import {getIsExternalModule} from '../utils/module.js';
import {
	EXTERNALS_SOURCE_ID,
	isExternalBuildId,
	DEFAULT_EXTERNALS_ALIASES,
} from './externalsBuildHelpers.js';

// TODO this is all hacky and should be refactored
// make it pluggable like builders, maybe

export const postprocess = (
	build: Build,
	ctx: BuildContext,
	result: BuildResult<Build>,
	source: BuildSource,
): {
	contents: Build['contents'];
	dependenciesByBuildId: Map<string, BuildDependency> | null;
} => {
	if (build.encoding === 'utf8') {
		let {contents, buildConfig} = build;
		const isBrowser = buildConfig.platform === 'browser';
		let dependenciesByBuildId: Map<string, BuildDependency> | null = null;

		// Map import paths to the built versions.
		if (build.extension === JS_EXTENSION) {
			const isExternalModule = getIsExternalModule(isBrowser);
			let transformedContents = '';
			let index = 0;
			// TODO what should we pass as the second arg to parse? the id? nothing? `lexer.parse(code, id);`
			const [imports] = lexer.parse(contents);
			for (const {s, e, d} of imports) {
				const start = d > -1 ? s + 1 : s;
				const end = d > -1 ? e - 1 : e;
				const specifier = contents.substring(start, end);
				if (specifier === 'import.meta') continue;
				let finalSpecifier = specifier; // this is the raw specifier, but pre-mapped for common externals
				let mappedSpecifier = toBuildExtension(specifier);
				let buildId: string;
				const isExternalImport = isExternalModule(specifier);
				if (!isExternalImport && source.id === EXTERNALS_SOURCE_ID) {
					// handle common externals, imports internal to the externals
					if (isBrowser) {
						buildId = join(build.dir, specifier);
						// map internal externals imports to absolute paths, so we get stable ids
						finalSpecifier = `/${toBuildBasePath(buildId, ctx.buildDir)}${
							finalSpecifier.endsWith(JS_EXTENSION) ? '' : JS_EXTENSION
						}`;
					} else {
						buildId = mappedSpecifier;
					}
				} else if (isExternalImport || source.id === EXTERNALS_SOURCE_ID) {
					// handle regular externals
					if (isBrowser) {
						if (mappedSpecifier in DEFAULT_EXTERNALS_ALIASES) {
							mappedSpecifier = DEFAULT_EXTERNALS_ALIASES[mappedSpecifier];
						}
						if (mappedSpecifier.endsWith(JS_EXTENSION) && shouldModifyDotJs(mappedSpecifier)) {
							mappedSpecifier = mappedSpecifier.replace(/\.js$/, 'js');
						}
						mappedSpecifier = `/${join(EXTERNALS_BUILD_DIR, mappedSpecifier)}${
							mappedSpecifier.endsWith(JS_EXTENSION) ? '' : JS_EXTENSION
						}`;
						buildId = toBuildOutPath(
							ctx.dev,
							buildConfig.name,
							mappedSpecifier.substring(1),
							ctx.buildDir,
						);
					} else {
						buildId = mappedSpecifier;
					}
				} else {
					buildId = join(build.dir, mappedSpecifier);
				}
				if (dependenciesByBuildId === null) dependenciesByBuildId = new Map();
				if (!dependenciesByBuildId.has(buildId)) {
					dependenciesByBuildId.set(buildId, {
						specifier: finalSpecifier,
						mappedSpecifier,
						buildId,
						external: isExternalBuildId(buildId, buildConfig, ctx),
						// TODO what if this had `originalSpecifier` and `isExternalImport` too?
					});
				}
				if (mappedSpecifier !== specifier) {
					transformedContents += contents.substring(index, start) + mappedSpecifier;
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
				for (const servedDir of ctx.servedDirs) {
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
		return {contents, dependenciesByBuildId};
	} else {
		// Handle other encodings like binary.
		return {contents: build.contents, dependenciesByBuildId: null};
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

// TODO tests as docs
const shouldModifyDotJs = (sourceId: string): boolean => {
	const maxSlashCount = sourceId[0] === '@' ? 1 : 0;
	let slashCount = 0;
	for (let i = 0; i < sourceId.length; i++) {
		if (sourceId[i] === '/') {
			slashCount++;
			if (slashCount > maxSlashCount) {
				return false;
			}
		}
	}
	return true;
};
