import {join, extname, relative} from 'node:path';
import * as lexer from 'es-module-lexer';
import type {Assignable} from '@feltjs/util/types.js';

import {
	paths,
	JS_EXTENSION,
	toBuildExtension,
	TS_EXTENSION,
	isThisProjectGro,
	type BuildId,
} from '../path/paths.js';
import type {BuildContext, BuildSource} from './builder.js';
import {isExternalModule, MODULE_PATH_LIB_PREFIX, MODULE_PATH_SRC_PREFIX} from '../path/module.js';
import type {BuildDependency} from './buildDependency.js';
import type {BuildFile} from './buildFile.js';

export interface Postprocess {
	(buildFile: BuildFile, ctx: BuildContext, source: BuildSource): Promise<void>;
}

// TODO refactor the TypeScript- and Svelte-specific postprocessing into the builders
// so this remains generic (maybe remove this completely and just have helpers)

// Mutates `buildFile` with possibly new `content` and `dependencies`.
// Defensively clone if upstream clone doesn't want mutation.
export const postprocess: Postprocess = async (buildFile, ctx, source) => {
	if (buildFile.encoding !== 'utf8') return;

	const {dir, extension, content: originalContent} = buildFile;

	let content = originalContent;
	let dependencies: Map<BuildId, BuildDependency> | null = null;

	const handleSpecifier: HandleSpecifier = (specifier) => {
		const buildDependency = toBuildDependency(specifier, dir, source, ctx);
		if (dependencies === null) dependencies = new Map();
		if (!dependencies.has(buildDependency.buildId)) {
			dependencies.set(buildDependency.buildId, buildDependency);
		}
		return buildDependency;
	};

	// Map import paths to the built versions.
	if (extension === JS_EXTENSION) {
		content = parseJsDependencies(content, handleSpecifier, true);
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
	if (mapDependencies) {
		if (index > 0) {
			return transformedContent + content.substring(index);
		}
		return content;
	}
	return '';
};

const toBuildDependency = (
	specifier: string,
	dir: string,
	source: BuildSource,
	{dev}: BuildContext,
): BuildDependency => {
	let buildId: BuildId;
	let finalSpecifier = specifier;
	const external = isExternalModule(specifier); // TODO should this be tracked?
	let mappedSpecifier: string;
	if (external) {
		mappedSpecifier = hackToSveltekitImportMocks(toBuildExtension(specifier), dev);
		// TODO is this needed?
		finalSpecifier = hackToSveltekitImportMocks(finalSpecifier, dev);
		buildId = mappedSpecifier;
	} else {
		// internal import
		finalSpecifier = toRelativeSpecifier(finalSpecifier, source.dir, paths.source);
		mappedSpecifier = hackToBuildExtensionWithPossiblyExtensionlessSpecifier(finalSpecifier);
		buildId = join(dir, mappedSpecifier);
	}
	return {
		specifier: finalSpecifier,
		mappedSpecifier,
		originalSpecifier: specifier,
		buildId,
		external,
	};
};

// Maps absolute `$lib/` and `src/` imports to relative specifiers.
const toRelativeSpecifier = (specifier: string, dir: string, sourceDir: string): string => {
	if (specifier.startsWith(MODULE_PATH_LIB_PREFIX)) {
		return toRelativeSpecifierTrimmedBy(1, specifier, dir, sourceDir);
	} else if (specifier.startsWith(MODULE_PATH_SRC_PREFIX)) {
		return toRelativeSpecifierTrimmedBy(3, specifier, dir, sourceDir);
	}
	return specifier;
};

const toRelativeSpecifierTrimmedBy = (
	charsToTrim: number,
	specifier: string,
	dir: string,
	sourceDir: string,
): string => {
	const s = relative(dir, sourceDir + specifier.substring(charsToTrim));
	return s.startsWith('.') ? s : './' + s;
};

// This is a temporary hack to allow importing `to/thing` as equivalent to `to/thing.js`,
// despite it being off-spec, because of this combination of problems with TypeScript and Vite:
// https://github.com/feltjs/gro/pull/186
// The main problem this causes is breaking the ability to infer file extensions automatically,
// because now we can't extract the extension from a user-provided specifier. Gack!
// Exposing this hack to user config is something that's probably needed,
// but we'd much prefer to remove it completely, and force internal import paths to conform to spec.
const hackToBuildExtensionWithPossiblyExtensionlessSpecifier = (specifier: string): string => {
	const extension = extname(specifier);
	return !extension || !HACK_EXTENSIONLESS_EXTENSIONS.has(extension)
		? specifier + JS_EXTENSION
		: toBuildExtension(specifier);
};

// This hack is needed so we treat imports like `foo.task` as `foo.task.js`, not a `.task` file.
const HACK_EXTENSIONLESS_EXTENSIONS = new Set([JS_EXTENSION, TS_EXTENSION]);

// TODO substitutes SvelteKit-specific paths for Gro's mocked version for testing purposes.
// should extract this so it's configurable. (this whole module is hacky and needs rethinking)
const hackToSveltekitImportMocks = (specifier: string, dev: boolean): string =>
	dev && sveltekitMockedSpecifiers.has(specifier)
		? sveltekitMockedSpecifiers.get(specifier)!
		: specifier;
const SVELTEKIT_IMPORT_MOCK_SPECIFIER = isThisProjectGro
	? '../../util/sveltekitImportMocks.js'
	: '@feltjs/gro/util/sveltekitImportMocks.js';
const sveltekitMockedSpecifiers = new Map([
	['$app/environment', SVELTEKIT_IMPORT_MOCK_SPECIFIER],
	['$app/forms', SVELTEKIT_IMPORT_MOCK_SPECIFIER],
	['$app/navigation', SVELTEKIT_IMPORT_MOCK_SPECIFIER],
	['$app/paths', SVELTEKIT_IMPORT_MOCK_SPECIFIER],
	['$app/stores', SVELTEKIT_IMPORT_MOCK_SPECIFIER],
]);
