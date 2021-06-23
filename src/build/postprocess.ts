import {join, extname} from 'path';
// `lexer.init` is expected to be awaited elsewhere before `postprocess` is called
import lexer from 'es-module-lexer';
import {strip_start} from '@feltcoop/felt/util/string.js';

import {
	CSS_EXTENSION,
	EXTERNALS_BUILD_DIRNAME,
	JS_EXTENSION,
	SVELTE_EXTENSION,
	to_build_base_path,
	to_build_extension,
	to_build_out_path,
	TS_EXTENSION,
} from '../paths.js';
import type {Build, Build_Context, Build_Result, Build_Source} from './builder.js';
import {is_external_module} from '../utils/module.js';
import {EXTERNALS_SOURCE_ID, is_external_build_id} from './externals_build_helpers.js';
import type {Build_Dependency} from './build_dependency.js';

// TODO this is all hacky and should be refactored
// make it pluggable like builders, maybe

export const postprocess = (
	build: Build,
	ctx: Build_Context,
	result: Build_Result<Build>,
	source: Build_Source,
): {
	content: Build['content'];
	dependencies_by_build_id: Map<string, Build_Dependency> | null;
} => {
	if (build.encoding === 'utf8') {
		let {content, build_config} = build;
		const browser = build_config.platform === 'browser';
		let dependencies_by_build_id: Map<string, Build_Dependency> | null = null;

		// Map import paths to the built versions.
		if (build.extension === JS_EXTENSION) {
			let transformed_content = '';
			let index = 0;
			// TODO what should we pass as the second arg to parse? the id? nothing? `lexer.parse(code, id);`
			const [imports] = lexer.parse(content);
			for (const {s, e, d} of imports) {
				const start = d > -1 ? s + 1 : s;
				const end = d > -1 ? e - 1 : e;
				const specifier = content.substring(start, end);
				if (specifier === 'import.meta') continue;
				let build_id: string;
				let final_specifier = specifier; // this is the raw specifier, but pre-mapped for common externals
				const is_external_import = is_external_module(specifier);
				const is_external_imported_by_external = source.id === EXTERNALS_SOURCE_ID;
				const is_external = is_external_import || is_external_imported_by_external;
				let mapped_specifier = is_external
					? to_build_extension(specifier)
					: hack_to_build_extension_with_possibly_extensionless_specifier(specifier);
				if (is_external) {
					if (is_external_import) {
						// handle regular externals
						if (browser) {
							if (mapped_specifier in ctx.externals_aliases) {
								mapped_specifier = ctx.externals_aliases[mapped_specifier];
							}
							const has_js_extension = mapped_specifier.endsWith(JS_EXTENSION);
							if (has_js_extension && should_modify_dot_js(mapped_specifier)) {
								mapped_specifier =
									mapped_specifier.substring(0, mapped_specifier.length - 3) + 'js';
							}
							mapped_specifier = `/${join(EXTERNALS_BUILD_DIRNAME, mapped_specifier)}${
								has_js_extension ? '' : JS_EXTENSION
							}`;
							build_id = to_build_out_path(
								ctx.dev,
								build_config.name,
								mapped_specifier.substring(1),
								ctx.build_dir,
							);
						} else {
							build_id = mapped_specifier;
						}
					} else {
						// handle common externals, imports internal to the externals
						if (browser) {
							build_id = join(build.dir, specifier);
							// map internal externals imports to absolute paths, so we get stable ids
							final_specifier = `/${to_build_base_path(build_id, ctx.build_dir)}${
								final_specifier.endsWith(JS_EXTENSION) ? '' : JS_EXTENSION
							}`;
						} else {
							// externals imported in Node builds use Node module resolution
							build_id = mapped_specifier;
						}
					}
				} else {
					// internal import
					build_id = join(build.dir, mapped_specifier);
				}
				if (dependencies_by_build_id === null) dependencies_by_build_id = new Map();
				if (!dependencies_by_build_id.has(build_id)) {
					dependencies_by_build_id.set(build_id, {
						specifier: final_specifier,
						mapped_specifier,
						build_id,
						external: is_external_build_id(build_id, build_config, ctx),
						// TODO what if this had `originalSpecifier` and `is_external_import` too?
					});
				}
				if (mapped_specifier !== specifier) {
					transformed_content += content.substring(index, start) + mapped_specifier;
					index = end;
				}
			}
			if (index > 0) {
				content = transformed_content + content.substring(index);
			}
		}

		// Support Svelte CSS for development in the browser.
		if (source.extension === SVELTE_EXTENSION && build.extension === JS_EXTENSION && browser) {
			const css_compilation = result.builds.find((c) => c.extension === CSS_EXTENSION);
			if (css_compilation !== undefined) {
				let import_path: string | undefined;
				for (const served_dir of ctx.served_dirs) {
					if (css_compilation.id.startsWith(served_dir.path)) {
						import_path = strip_start(css_compilation.id, served_dir.root);
						break;
					}
				}
				if (import_path !== undefined) {
					content = inject_svelte_css_import(content, import_path);
				}
			}
		}
		return {content, dependencies_by_build_id};
	} else {
		// Handle other encodings like binary.
		return {content: build.content, dependencies_by_build_id: null};
	}
};

const inject_svelte_css_import = (content: string, import_path: string): string => {
	let newline_index = content.length;
	for (let i = 0; i < content.length; i++) {
		if (content[i] === '\n') {
			newline_index = i;
			break;
		}
	}
	const injected_css_loader_script = `;globalThis.gro.register_css('${import_path}');`; // account for barbaric semicolonness code
	const new_content = `${content.substring(
		0,
		newline_index,
	)}${injected_css_loader_script}${content.substring(newline_index)}`;
	return new_content;
};

// TODO tests as docs
const should_modify_dot_js = (source_id: string): boolean => {
	const max_slash_count = source_id[0] === '@' ? 1 : 0;
	let slash_count = 0;
	for (let i = 0; i < source_id.length; i++) {
		if (source_id[i] === '/') {
			slash_count++;
			if (slash_count > max_slash_count) {
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
const hack_to_build_extension_with_possibly_extensionless_specifier = (
	specifier: string,
): string => {
	const extension = extname(specifier);
	return !extension || !HACK_EXTENSIONLESS_EXTENSIONS.has(extension)
		? specifier + JS_EXTENSION
		: to_build_extension(specifier);
};

// This hack is needed so we treat imports like `foo.task` as `foo.task.js`, not a `.task` file.
const HACK_EXTENSIONLESS_EXTENSIONS = new Set([SVELTE_EXTENSION, JS_EXTENSION, TS_EXTENSION]);
