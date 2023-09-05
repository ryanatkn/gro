import {join, extname, relative} from 'node:path';
import * as lexer from 'es-module-lexer';

import {
	paths,
	JS_EXTENSION,
	toBuildExtension,
	TS_EXTENSION,
	isThisProjectGro,
	type BuildId,
} from '../path/paths.js';
import {isExternalModule, MODULE_PATH_LIB_PREFIX, MODULE_PATH_SRC_PREFIX} from '../path/module.js';
import type {BuildDependency} from './buildDependency.js';

export interface Postprocess {
	(
		content: string,
		buildDir: string,
		sourceDir: string,
	): {content: string; dependencies: Map<BuildId, BuildDependency> | null};
}

export const postprocess: Postprocess = (originalContent, buildDir, sourceDir) => {
	let dependencies: Map<BuildId, BuildDependency> | null = null;

	// Map import paths to the built versions.
	const handle_specifier: HandleSpecifier = (specifier) => {
		const buildDependency = to_build_dependency(specifier, buildDir, sourceDir);
		if (dependencies === null) dependencies = new Map();
		if (!dependencies.has(buildDependency.buildId)) {
			dependencies.set(buildDependency.buildId, buildDependency);
		}
		return buildDependency;
	};

	const content = parse_js_dependencies(originalContent, handle_specifier, true);

	return {content, dependencies};
};

interface HandleSpecifier {
	(specifier: string): BuildDependency;
}

const parse_js_dependencies = (
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

const to_build_dependency = (
	specifier: string,
	buildDir: string,
	sourceDir: string,
): BuildDependency => {
	let buildId: BuildId;
	let finalSpecifier = specifier;
	const external = isExternalModule(specifier); // TODO should this be tracked?
	let mappedSpecifier: string;
	if (external) {
		mappedSpecifier = to_relative_specifier(
			hack_to_sveltekit_import_shims(toBuildExtension(specifier)),
			sourceDir,
			paths.source,
		);
		finalSpecifier = to_relative_specifier(
			hack_to_sveltekit_import_shims(finalSpecifier),
			sourceDir,
			paths.source,
		);
		buildId = mappedSpecifier;
	} else {
		// internal import
		finalSpecifier = to_relative_specifier(finalSpecifier, sourceDir, paths.source);
		mappedSpecifier = hack_to_build_extension_with_possibly_extensionless_specifier(finalSpecifier);
		buildId = join(buildDir, mappedSpecifier);
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
const to_relative_specifier = (specifier: string, dir: string, sourceDir: string): string => {
	if (specifier.startsWith(MODULE_PATH_LIB_PREFIX)) {
		return to_relative_specifier_trimmed_by(1, specifier, dir, sourceDir);
	} else if (specifier.startsWith(MODULE_PATH_SRC_PREFIX)) {
		return to_relative_specifier_trimmed_by(3, specifier, dir, sourceDir);
	}
	return specifier;
};

const to_relative_specifier_trimmed_by = (
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
const hack_to_build_extension_with_possibly_extensionless_specifier = (
	specifier: string,
): string => {
	const extension = extname(specifier);
	return !extension || !HACK_EXTENSIONLESS_EXTENSIONS.has(extension)
		? specifier + JS_EXTENSION
		: toBuildExtension(specifier);
};

// This hack is needed so we treat imports like `foo.task` as `foo.task.js`, not a `.task` file.
const HACK_EXTENSIONLESS_EXTENSIONS = new Set([JS_EXTENSION, TS_EXTENSION]);

// TODO substitutes SvelteKit-specific paths for Gro's mocked version for testing purposes.
// should extract this so it's configurable. (this whole module is hacky and needs rethinking)
const hack_to_sveltekit_import_shims = (specifier: string): string =>
	sveltekitMockedSpecifiers.has(specifier) ? sveltekitMockedSpecifiers.get(specifier)! : specifier;

const to_sveltekit_shim_app_specifier = (filename: string) =>
	(isThisProjectGro ? '../../util/' : '@feltjs/gro/util/') + filename;

const to_sveltekit_shim_env_specifier = (filename: string) =>
	(isThisProjectGro ? '../../util/' : '$lib/') + filename;

const sveltekitMockedSpecifiers = new Map([
	['$app/environment', to_sveltekit_shim_app_specifier('sveltekit_shim_app_environment.js')],
	['$app/forms', to_sveltekit_shim_app_specifier('sveltekit_shim_app_forms.js')],
	['$app/navigation', to_sveltekit_shim_app_specifier('sveltekit_shim_app_navigation.js')],
	['$app/paths', to_sveltekit_shim_app_specifier('sveltekit_shim_app_paths.js')],
	['$app/stores', to_sveltekit_shim_app_specifier('sveltekit_shim_app_stores.js')],
	['$env/static/public', to_sveltekit_shim_env_specifier('sveltekit_shim_env_static_public.js')],
	['$env/static/private', to_sveltekit_shim_env_specifier('sveltekit_shim_env_static_private.js')],
	['$env/dynamic/public', to_sveltekit_shim_env_specifier('sveltekit_shim_env_dynamic_public.js')],
	[
		'$env/dynamic/private',
		to_sveltekit_shim_env_specifier('sveltekit_shim_env_dynamic_private.js'),
	],
]);
