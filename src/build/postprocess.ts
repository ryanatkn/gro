import {join, extname, relative, basename} from 'path';
import * as lexer from 'es-module-lexer';
import type {Assignable} from '@feltcoop/felt';

import {
	paths,
	CSS_EXTENSION,
	EXTERNALS_BUILD_DIRNAME,
	JS_EXTENSION,
	SVELTE_EXTENSION,
	toBuildExtension,
	toBuildOutPath,
	TS_EXTENSION,
	TS_TYPE_EXTENSION,
} from '../paths.js';
import type {BuildContext, BuildSource} from 'src/build/builder.js';
import {
	isExternalModule,
	MODULE_PATH_LIB_PREFIX,
	MODULE_PATH_SRC_PREFIX,
} from '../utils/module.js';
import {EXTERNALS_SOURCE_ID} from './groBuilderExternalsUtils.js';
import type {BuildDependency} from 'src/build/buildDependency.js';
import {extractJsFromSvelteForDependencies} from './groBuilderSvelteUtils.js';
import type {BuildConfig} from 'src/build/buildConfig.js';
import type {BuildFile} from 'src/build/buildFile.js';

export interface Postprocess {
	(
		buildFile: BuildFile,
		ctx: BuildContext,
		buildFiles: BuildFile[],
		source: BuildSource,
	): Promise<void>;
}

// TODO refactor the TypeScript- and Svelte-specific postprocessing into the builders
// so this remains generic (maybe remove this completely and just have helpers)

// Mutates `buildFile` with possibly new `content` and `dependencies`.
// Defensively clone if upstream clone doesn't want mutation.
export const postprocess: Postprocess = async (buildFile, ctx, buildFiles, source) => {
	if (buildFile.encoding !== 'utf8') return;

	const {dir, extension, content: originalContent, buildConfig} = buildFile;

	let content = originalContent;
	const browser = buildConfig.platform === 'browser';
	let dependencies: Map<string, BuildDependency> | null = null;

	const handleSpecifier: HandleSpecifier = (specifier) => {
		const buildDependency = toBuildDependency(specifier, dir, buildConfig, source, ctx);
		if (dependencies === null) dependencies = new Map();
		if (!dependencies.has(buildDependency.buildId)) {
			dependencies.set(buildDependency.buildId, buildDependency);
		}
		return buildDependency;
	};

	// Map import paths to the built versions.
	switch (extension) {
		case JS_EXTENSION: {
			content = parseJsDependencies(content, handleSpecifier, true);
			if (
				ctx.types &&
				(source.extension === TS_EXTENSION || source.extension === SVELTE_EXTENSION)
			) {
				parseTypeDependencies(source.content as string, handleSpecifier);
			}
			break;
		}
		case SVELTE_EXTENSION: {
			// Support Svelte in production, outputting the plain `.svelte`
			// but extracting and mapping dependencies.
			const extractedJs = await extractJsFromSvelteForDependencies(originalContent);
			parseJsDependencies(extractedJs, handleSpecifier, false);
			if (ctx.types) {
				parseTypeDependencies(content as string, handleSpecifier);
			}
			content = replaceDependencies(content, dependencies);
			break;
		}
		case TS_TYPE_EXTENSION: {
			parseTypeDependencies(content, handleSpecifier);
			content = replaceDependencies(content, dependencies);
			break;
		}
	}

	// Support Svelte CSS for development in the browser.
	if (browser && source.extension === SVELTE_EXTENSION && extension === JS_EXTENSION) {
		const cssBuildFile = buildFiles.find((c) => c.extension === CSS_EXTENSION);
		if (cssBuildFile !== undefined) {
			// TODO this is hardcoded to a sibling module, but that may be overly restrictive --
			// a previous version of this code used the `ctx.servedDirs` to handle any location,
			// but this coupled the build outputs to the served dirs, which failed and is weird
			const importPath = `./${basename(cssBuildFile.filename)}`;
			content = injectSvelteCssImport(content, importPath, ctx.dev);
		}
	}

	(buildFile as Assignable<BuildFile, 'content'>).content = content;
	(buildFile as Assignable<BuildFile, 'dependencies'>).dependencies = dependencies;
};

interface HandleSpecifier {
	(specifier: string): BuildDependency;
}

const parseJsDependencies = (
	content: string,
	handleSpecifier: HandleSpecifier,
	mapDependencies: boolean,
): string => {
	let transformedContent = '';
	let index = 0;
	// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
	// TODO what should we pass as the second arg to parse? the id? nothing? `lexer.parse(code, id);`
	const [imports] = lexer.parse(content);
	let start: number;
	let end: number;
	let backticked = false;
	for (const {s, e, d} of imports) {
		if (d > -1) {
			const firstChar = content[s];
			if (firstChar === '`') {
				// allow template strings, but not interpolations -- see code ahead
				backticked = true;
			} else if (firstChar !== `'` && firstChar !== '"') {
				// ignore non-literals
				continue;
			}
			start = s + 1;
			end = e - 1;
		} else {
			start = s;
			end = e;
		}
		const specifier = content.substring(start, end);
		if (backticked) {
			backticked = false;
			if (specifier.includes('${')) continue;
		}
		if (specifier === 'import.meta') continue;
		const buildDependency = handleSpecifier(specifier);
		if (mapDependencies && buildDependency.mappedSpecifier !== specifier) {
			transformedContent += content.substring(index, start) + buildDependency.mappedSpecifier;
			index = end;
		}
	}
	if (mapDependencies && index > 0) {
		content = transformedContent + content.substring(index);
	}
	return mapDependencies ? content : '';
};

const toBuildDependency = (
	specifier: string,
	dir: string,
	buildConfig: BuildConfig,
	source: BuildSource,
	ctx: BuildContext,
): BuildDependency => {
	const {dev, externalsAliases, buildDir} = ctx;
	let buildId: string;
	let finalSpecifier = specifier; // this is the raw specifier, but pre-mapped for common externals
	const prebundle = dev && buildConfig.platform === 'browser'; // don't prebundle in production
	const isExternalImport = isExternalModule(specifier);
	const isExternalImportedByExternal = source.id === EXTERNALS_SOURCE_ID;
	const isExternal = isExternalImport || isExternalImportedByExternal;
	let mappedSpecifier: string;
	if (isExternal) {
		mappedSpecifier = toBuildExtension(specifier, dev);
		if (isExternalImport) {
			// handle regular externals
			if (prebundle) {
				if (mappedSpecifier in externalsAliases) {
					mappedSpecifier = externalsAliases[mappedSpecifier];
				}
				const hasJsExtension = mappedSpecifier.endsWith(JS_EXTENSION);
				if (hasJsExtension && shouldModifyDotJs(mappedSpecifier)) {
					mappedSpecifier = mappedSpecifier.substring(0, mappedSpecifier.length - 3) + 'js';
				}
				const specifierBasePath = `${EXTERNALS_BUILD_DIRNAME}/${mappedSpecifier}${
					hasJsExtension ? '' : JS_EXTENSION
				}`;
				mappedSpecifier = relative(source.dir, paths.source + specifierBasePath);
				if (mappedSpecifier[0] !== '.') {
					mappedSpecifier = `./${mappedSpecifier}`;
				}
				buildId = toBuildOutPath(dev, buildConfig.name, specifierBasePath, buildDir);
			} else {
				buildId = mappedSpecifier;
			}
		} else {
			// handle common externals, imports internal to the externals
			if (prebundle) {
				buildId = join(dir, specifier);
				// use absolute paths for internal externals specifiers, so we get stable ids
				finalSpecifier = buildId;
			} else {
				// externals imported in production and Node builds use Node module resolution
				buildId = mappedSpecifier;
			}
		}
	} else {
		// internal import
		finalSpecifier = toRelativeSpecifier(finalSpecifier, source.dir, paths.source);
		mappedSpecifier = hackToBuildExtensionWithPossiblyExtensionlessSpecifier(
			finalSpecifier,
			dev,
		);
		buildId = join(dir, mappedSpecifier);
	}
	return {
		specifier: finalSpecifier,
		mappedSpecifier,
		originalSpecifier: specifier,
		buildId,
		external: prebundle && isExternal,
	};
};

// Maps absolute `$lib/` and `src/` imports to relative specifiers.
const toRelativeSpecifier = (specifier: string, dir: string, sourceDir: string): string => {
	if (specifier.startsWith(MODULE_PATH_LIB_PREFIX)) {
		specifier = toRelativeSpecifierTrimmedBy(1, specifier, dir, sourceDir);
	} else if (specifier.startsWith(MODULE_PATH_SRC_PREFIX)) {
		specifier = toRelativeSpecifierTrimmedBy(3, specifier, dir, sourceDir);
	}
	return specifier;
};

const toRelativeSpecifierTrimmedBy = (
	charsToTrim: number,
	specifier: string,
	dir: string,
	sourceDir: string,
): string => {
	specifier = relative(dir, sourceDir + specifier.substring(charsToTrim));
	if (specifier[0] !== '.') specifier = './' + specifier;
	return specifier;
};

/*

TODO this fails on some input:

export declare type AsyncStatus = 'initial' | 'pending' | 'success' | 'failure';
const a = "from './array'";

Some possible improvements:

- add some negating condition to `[\s\S]*?` -- maybe a semicolon should break it?
- expect a semicolon

*/
const parseTypeDependencies = (content: string, handleSpecifier: HandleSpecifier): void => {
	for (const matches of content.matchAll(
		/(import\s+type|export)[\s\S]*?from\s*['|"|\`](.+)['|"|\`]/gm,
	)) {
		handleSpecifier(matches[2]);
	}
};

const replaceDependencies = (
	content: string,
	dependencies: Map<string, BuildDependency> | null,
): string => {
	if (dependencies === null) return content;
	let finalContent = content;
	for (const dependency of dependencies.values()) {
		if (dependency.originalSpecifier === dependency.mappedSpecifier) {
			continue;
		}
		finalContent = finalContent.replace(
			new RegExp(`['|"|\`]${escapeRegexp(dependency.originalSpecifier)}['|"|\`]`, 'g'),
			`'${dependency.mappedSpecifier}'`,
		);
	}
	return finalContent;
};

// TODO upstream to felt probably
// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/RegularExpressions
const escapeRegexp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const injectSvelteCssImport = (content: string, importPath: string, dev: boolean): string => {
	let newlineIndex = content.length;
	for (let i = 0; i < content.length; i++) {
		if (content[i] === '\n') {
			newlineIndex = i;
			break;
		}
	}
	const injectedCssLoaderScript = dev
		? `;globalThis.gro.registerCss('${importPath}');`
		: `;import '${importPath}';`;
	const newContent = `${content.substring(
		0,
		newlineIndex,
	)}${injectedCssLoaderScript}${content.substring(newlineIndex)}`;
	return newContent;
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
const hackToBuildExtensionWithPossiblyExtensionlessSpecifier = (
	specifier: string,
	dev: boolean,
): string => {
	const extension = extname(specifier);
	return !extension || !HACK_EXTENSIONLESS_EXTENSIONS.has(extension)
		? specifier + JS_EXTENSION
		: toBuildExtension(specifier, dev);
};

// This hack is needed so we treat imports like `foo.task` as `foo.task.js`, not a `.task` file.
const HACK_EXTENSIONLESS_EXTENSIONS = new Set([SVELTE_EXTENSION, JS_EXTENSION, TS_EXTENSION]);
