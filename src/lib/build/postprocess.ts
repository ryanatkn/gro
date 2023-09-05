import {join, extname, relative} from 'node:path';
import * as lexer from 'es-module-lexer';

import {
	paths,
	JS_EXTENSION,
	toBuildExtension as to_build_extension,
	TS_EXTENSION,
	is_this_project_gro,
	type BuildId,
} from '../path/paths.js';
import {
	isExternalModule as is_external_module,
	MODULE_PATH_LIB_PREFIX,
	MODULE_PATH_SRC_PREFIX,
} from '../path/module.js';
import type {BuildDependency} from './buildDependency.js';

export interface Postprocess {
	(
		content: string,
		build_dir: string,
		source_dir: string,
	): {content: string; dependencies: Map<BuildId, BuildDependency> | null};
}

/**
 * Transforms the content of a JS file to support SvelteKit patterns
 * including $lib imports and shims for $app and $env imports.
 * TODO ideally this would be an esbuild plugin
 */
export const postprocess: Postprocess = (original_content, build_dir, source_dir) => {
	let dependencies: Map<BuildId, BuildDependency> | null = null;

	// Map import paths to the built versions.
	const handle_specifier: HandleSpecifier = (specifier) => {
		const build_dependency = to_build_dependency(specifier, build_dir, source_dir);
		if (dependencies === null) dependencies = new Map();
		if (!dependencies.has(build_dependency.build_id)) {
			dependencies.set(build_dependency.build_id, build_dependency);
		}
		return build_dependency;
	};

	const content = parse_js_dependencies(original_content, handle_specifier, true);

	return {content, dependencies};
};

interface HandleSpecifier {
	(specifier: string): BuildDependency;
}

const parse_js_dependencies = (
	content: string,
	handle_specifier: HandleSpecifier,
	map_dependencies: boolean,
): string => {
	let transformed = '';
	let index = 0;
	// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
	// TODO what should we pass as the second arg to parse? the id? nothing? `lexer.parse(code, id);`
	const [imports] = lexer.parse(content);
	let start: number;
	let end: number;
	let backticked = false;
	for (const {s, e, d} of imports) {
		if (d > -1) {
			const first_char = content[s];
			if (first_char === '`') {
				// allow template strings, but not interpolations -- see code ahead
				backticked = true;
			} else if (first_char !== `'` && first_char !== '"') {
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
		const build_dependency = handle_specifier(specifier);
		if (map_dependencies && build_dependency.mapped_specifier !== specifier) {
			transformed += content.substring(index, start) + build_dependency.mapped_specifier;
			index = end;
		}
	}
	if (map_dependencies) {
		if (index > 0) {
			return transformed + content.substring(index);
		}
		return content;
	}
	return '';
};

const to_build_dependency = (
	specifier: string,
	build_dir: string,
	source_dir: string,
): BuildDependency => {
	let build_id: BuildId;
	let final_specifier = specifier;
	const external = is_external_module(specifier); // TODO should this be tracked?
	let mapped_specifier: string;
	if (external) {
		mapped_specifier = to_relative_specifier(
			hack_to_sveltekit_import_shims(to_build_extension(specifier)),
			source_dir,
			paths.source,
		);
		final_specifier = to_relative_specifier(
			hack_to_sveltekit_import_shims(final_specifier),
			source_dir,
			paths.source,
		);
		build_id = mapped_specifier;
	} else {
		// internal import
		final_specifier = to_relative_specifier(final_specifier, source_dir, paths.source);
		mapped_specifier =
			hack_to_build_extension_with_possibly_extensionless_specifier(final_specifier);
		build_id = join(build_dir, mapped_specifier);
	}
	return {
		specifier: final_specifier,
		mapped_specifier,
		original_specifier: specifier,
		build_id,
		external,
	};
};

// Maps absolute `$lib/` and `src/` imports to relative specifiers.
const to_relative_specifier = (specifier: string, dir: string, source_dir: string): string => {
	if (specifier.startsWith(MODULE_PATH_LIB_PREFIX)) {
		return to_relative_specifier_trimmed_by(1, specifier, dir, source_dir);
	} else if (specifier.startsWith(MODULE_PATH_SRC_PREFIX)) {
		return to_relative_specifier_trimmed_by(3, specifier, dir, source_dir);
	}
	return specifier;
};

const to_relative_specifier_trimmed_by = (
	chars_to_trim: number,
	specifier: string,
	dir: string,
	source_dir: string,
): string => {
	const s = relative(dir, source_dir + specifier.substring(chars_to_trim));
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
		: to_build_extension(specifier);
};

// This hack is needed so we treat imports like `foo.task` as `foo.task.js`, not a `.task` file.
const HACK_EXTENSIONLESS_EXTENSIONS = new Set([JS_EXTENSION, TS_EXTENSION]);

// TODO substitutes SvelteKit-specific paths for Gro's mocked version for testing purposes.
// should extract this so it's configurable. (this whole module is hacky and needs rethinking)
const hack_to_sveltekit_import_shims = (specifier: string): string =>
	sveltekit_stubbed_specifiers.has(specifier)
		? sveltekit_stubbed_specifiers.get(specifier)!
		: specifier;

const to_sveltekit_shim_app_specifier = (filename: string) =>
	(is_this_project_gro ? '../../util/' : '@feltjs/gro/util/') + filename;

const to_sveltekit_shim_env_specifier = (filename: string) =>
	(is_this_project_gro ? '../../util/' : '$lib/') + filename;

const sveltekit_stubbed_specifiers = new Map([
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
