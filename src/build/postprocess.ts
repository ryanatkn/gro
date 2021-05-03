import {join, extname} from 'path';
// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';

import {
	CSS_EXTENSION,
	EXTERNALS_BUILD_DIRNAME,
	JS_EXTENSION,
	SVELTE_EXTENSION,
	toBuildBasePath,
	toBuildExtension,
	toBuildOutPath,
	TS_EXTENSION,
} from '../paths.js';
import type {Build, BuildContext, BuildResult, BuildSource, BuildDependency} from './builder.js';
import {stripStart} from '../utils/string.js';
import {toIsExternalModule} from '../utils/module.js';
import {EXTERNALS_SOURCE_ID, isExternalBuildId} from './externalsBuildHelpers.js';

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
			const isExternalModule = toIsExternalModule(isBrowser);
			let transformedContents = '';
			let index = 0;
			// TODO what should we pass as the second arg to parse? the id? nothing? `lexer.parse(code, id);`
			const [imports] = lexer.parse(contents);
			for (const {s, e, d} of imports) {
				const start = d > -1 ? s + 1 : s;
				const end = d > -1 ? e - 1 : e;
				const specifier = contents.substring(start, end);
				if (specifier === 'import.meta') continue;
				let buildId: string;
				let finalSpecifier = specifier; // this is the raw specifier, but pre-mapped for common externals
				const isExternalImport = isExternalModule(specifier);
				const isExternalImportedByExternal = source.id === EXTERNALS_SOURCE_ID;
				const isExternal = isExternalImport || isExternalImportedByExternal;
				let mappedSpecifier = isExternal
					? toBuildExtension(specifier)
					: hack_toBuildExtensionWithPossiblyExtensionlessSpecifier(specifier);
				if (isExternal) {
					if (isExternalImport) {
						// handle regular externals
						if (isBrowser) {
							if (mappedSpecifier in ctx.externalsAliases) {
								mappedSpecifier = ctx.externalsAliases[mappedSpecifier];
							}
							if (mappedSpecifier.endsWith(JS_EXTENSION) && shouldModifyDotJs(mappedSpecifier)) {
								mappedSpecifier = mappedSpecifier.replace(/\.js$/, 'js');
							}
							mappedSpecifier = `/${join(EXTERNALS_BUILD_DIRNAME, mappedSpecifier)}${
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
						// handle common externals, imports internal to the externals
						if (isBrowser) {
							buildId = join(build.dir, specifier);
							// map internal externals imports to absolute paths, so we get stable ids
							finalSpecifier = `/${toBuildBasePath(buildId, ctx.buildDir)}${
								finalSpecifier.endsWith(JS_EXTENSION) ? '' : JS_EXTENSION
							}`;
						} else {
							// externals imported in Node builds use Node module resolution
							buildId = mappedSpecifier;
						}
					}
				} else {
					// internal import
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
					if (cssCompilation.id.startsWith(servedDir.path)) {
						importPath = stripStart(cssCompilation.id, servedDir.root);
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

// This is a temporary hack to allow importing `to/thing` as equivalent to `to/thing.js`,
// despite it being off-spec, because of this combination of problems with TypeScript and Vite:
// https://github.com/feltcoop/gro/pull/186
// The main problem this causes is breaking the ability to infer file extensions automatically,
// because now we can't extract the extension from a user-provided specifier. Gack!
// Exposing this hack to user config is something that's probably needed,
// but we'd much prefer to remove it completely, and force internal import paths to conform to spec.
const HACK_EXTENSIONLESS_EXTENSIONS = new Set([SVELTE_EXTENSION, JS_EXTENSION, TS_EXTENSION]);
const hack_toBuildExtensionWithPossiblyExtensionlessSpecifier = (specifier: string): string => {
	const extension = extname(specifier);
	return !extension || !HACK_EXTENSIONLESS_EXTENSIONS.has(extension)
		? specifier + JS_EXTENSION
		: toBuildExtension(specifier);
};
