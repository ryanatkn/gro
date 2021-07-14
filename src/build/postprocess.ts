import {join, extname, relative, basename} from 'path';
import * as lexer from 'es-module-lexer';

import {
	paths,
	CSS_EXTENSION,
	EXTERNALS_BUILD_DIRNAME,
	JS_EXTENSION,
	SVELTE_EXTENSION,
	to_build_extension,
	to_build_out_path,
	TS_EXTENSION,
	TS_TYPE_EXTENSION,
} from '../paths.js';
import type {Build_Context, Build_Source} from 'src/build/builder.js';
import {
	is_external_module,
	MODULE_PATH_LIB_PREFIX,
	MODULE_PATH_SRC_PREFIX,
} from '../utils/module.js';
import {EXTERNALS_SOURCE_ID} from './gro_builder_externals_utils.js';
import type {Build_Dependency} from 'src/build/build_dependency.js';
import {extract_js_from_svelte_for_dependencies} from './gro_builder_svelte_utils.js';
import type {Build_Config} from 'src/build/build_config.js';
import type {Build_File} from 'src/build/build_file.js';

export interface Postprocess {
	(
		build_file: Build_File,
		ctx: Build_Context,
		build_files: Build_File[],
		source: Build_Source,
	): Promise<Build_File>;
}

// TODO refactor the TypeScript- and Svelte-specific postprocessing into the builders
// so this remains generic (maybe remove this completely and just have helpers)

export const postprocess: Postprocess = async (build_file, ctx, build_files, source) => {
	if (build_file.encoding !== 'utf8') return build_file;

	const {dir, extension, content: original_content, build_config} = build_file;

	let content = original_content;
	const browser = build_config.platform === 'browser';
	let dependencies_by_build_id: Map<string, Build_Dependency> | null = null;

	const handle_specifier: Handle_Specifier = (specifier) => {
		const build_dependency = to_build_dependency(specifier, dir, build_config, source, ctx);
		if (dependencies_by_build_id === null) dependencies_by_build_id = new Map();
		if (!dependencies_by_build_id.has(build_dependency.build_id)) {
			dependencies_by_build_id.set(build_dependency.build_id, build_dependency);
		}
		return build_dependency;
	};

	// Map import paths to the built versions.
	if (extension === JS_EXTENSION) {
		content = parse_dependencies(content, handle_specifier, true);
	} else if (extension === SVELTE_EXTENSION) {
		// Support Svelte in production, outputting the plain `.svelte`
		// but extracting and mapping dependencies.
		// TODO this is hacky but seems the least-bad way to do it
		// 1. compile to JS with the Svelte preprocessor
		const extracted_js = await extract_js_from_svelte_for_dependencies(original_content);
		// 2. use the existing dependency parsing and path transformation process
		parse_dependencies(extracted_js, handle_specifier, false);
		// 3. hackily replace the import paths in the original Svelte using a regexp
		if (dependencies_by_build_id !== null) {
			// `dependencies_by_build_id` has been set by `handle_specifier`
			for (const dependency of (
				dependencies_by_build_id as Map<string, Build_Dependency>
			).values()) {
				if (dependency.original_specifier === dependency.mapped_specifier) {
					continue;
				}
				content = content.replace(
					// TODO doesn't match exports -- probably should?
					// TODO try to fix this to match against `import ...` and make sure it's not greedily broken
					// TODO escape interpolated value?
					new RegExp(`['|"|\`]${escape_regexp(dependency.original_specifier)}['|"|\`]`, 'g'),
					`'${dependency.mapped_specifier}'`,
				);
			}
		}
	} else if (extension === TS_TYPE_EXTENSION) {
		const specifiers = parse_ts_imports_and_exports(content);
		console.log('specifiers', specifiers);
		for (const specifier of specifiers) {
			handle_specifier(specifier);
		}
		// TODO is copypasta from above
		if (dependencies_by_build_id !== null) {
			// `dependencies_by_build_id` has been set by `handle_specifier`
			for (const dependency of (
				dependencies_by_build_id as Map<string, Build_Dependency>
			).values()) {
				if (dependency.original_specifier === dependency.mapped_specifier) {
					continue;
				}
				// TODO short-circuit if dep isn't mapped
				content = content.replace(
					// TODO doesn't match exports -- probably should?
					// TODO try to fix this to match against `import ...` and make sure it's not greedily broken
					// TODO escape interpolated value?
					new RegExp(`['|"|\`]${escape_regexp(dependency.original_specifier)}['|"|\`]`, 'g'),
					`'${dependency.mapped_specifier}'`,
				);
			}
		}
		// console.log('build_file.id', build_file.id);
		// console.log('matches', matches);
		// TODO try to fix this to match against `import ...` and make sure it's not greedily broken
		// 	,
		// 	`$1 $2from '$3'`,
		// );
	}

	// For TS files, we need to separately parse type imports and add them to the dependencies,
	// because by the time we parse the JS files above with `es-module-lexer`,
	// we've already lost the `import type` information from the TypeScript source.
	// TODO probably refactor into Rollup-like plugins
	if (
		ctx.types &&
		((source.extension === TS_EXTENSION && extension === JS_EXTENSION) ||
			(source.extension === SVELTE_EXTENSION &&
				(extension === JS_EXTENSION || extension === SVELTE_EXTENSION)))
	) {
		const specifiers = parse_type_imports(source.content as string);
		for (const specifier of specifiers) {
			handle_specifier(specifier);
		}
	}

	// Support Svelte CSS for development in the browser.
	if (browser && source.extension === SVELTE_EXTENSION && extension === JS_EXTENSION) {
		const css_build_file = build_files.find((c) => c.extension === CSS_EXTENSION);
		if (css_build_file !== undefined) {
			// TODO this is hardcoded to a sibling module, but that may be overly restrictive --
			// a previous version of this code used the `ctx.served_dirs` to handle any location,
			// but this coupled the build outputs to the served dirs, which failed and is weird
			const import_path = `./${basename(css_build_file.filename)}`;
			content = inject_svelte_css_import(content, import_path, ctx.dev);
		}
	}

	return {...build_file, content, dependencies_by_build_id};
};

interface Handle_Specifier {
	(specifier: string): Build_Dependency;
}

const parse_dependencies = (
	content: string,
	handle_specifier: Handle_Specifier,
	map_dependencies: boolean,
): string => {
	let transformed_content = '';
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
			transformed_content += content.substring(index, start) + build_dependency.mapped_specifier;
			index = end;
		}
	}
	if (map_dependencies && index > 0) {
		content = transformed_content + content.substring(index);
	}
	return map_dependencies ? content : '';
};

const to_build_dependency = (
	specifier: string,
	dir: string,
	build_config: Build_Config,
	source: Build_Source,
	ctx: Build_Context,
): Build_Dependency => {
	const {dev, externals_aliases, build_dir} = ctx;
	let build_id: string;
	let final_specifier = specifier; // this is the raw specifier, but pre-mapped for common externals
	const prebundle = dev && build_config.platform === 'browser'; // don't prebundle in production
	const is_external_import = is_external_module(specifier);
	const is_external_imported_by_external = source.id === EXTERNALS_SOURCE_ID;
	const is_external = is_external_import || is_external_imported_by_external;
	let mapped_specifier: string;
	if (is_external) {
		mapped_specifier = to_build_extension(specifier, dev);
		if (is_external_import) {
			// handle regular externals
			if (prebundle) {
				if (mapped_specifier in externals_aliases) {
					mapped_specifier = externals_aliases[mapped_specifier];
				}
				const has_js_extension = mapped_specifier.endsWith(JS_EXTENSION);
				if (has_js_extension && should_modify_dot_js(mapped_specifier)) {
					mapped_specifier = mapped_specifier.substring(0, mapped_specifier.length - 3) + 'js';
				}
				const specifier_base_path = `${EXTERNALS_BUILD_DIRNAME}/${mapped_specifier}${
					has_js_extension ? '' : JS_EXTENSION
				}`;
				mapped_specifier = relative(source.dir, paths.source + specifier_base_path);
				if (mapped_specifier[0] !== '.') {
					mapped_specifier = `./${mapped_specifier}`;
				}
				build_id = to_build_out_path(dev, build_config.name, specifier_base_path, build_dir);
			} else {
				build_id = mapped_specifier;
			}
		} else {
			// handle common externals, imports internal to the externals
			if (prebundle) {
				build_id = join(dir, specifier);
				// use absolute paths for internal externals specifiers, so we get stable ids
				final_specifier = build_id;
			} else {
				// externals imported in production and Node builds use Node module resolution
				build_id = mapped_specifier;
			}
		}
	} else {
		// internal import
		final_specifier = to_relative_specifier(final_specifier, source.dir, paths.source);
		mapped_specifier = hack_to_build_extension_with_possibly_extensionless_specifier(
			final_specifier,
			dev,
		);
		build_id = join(dir, mapped_specifier);
	}
	return {
		specifier: final_specifier,
		mapped_specifier,
		original_specifier: specifier,
		build_id,
		external: prebundle && is_external,
	};
};

// Maps absolute `$lib/` and `src/` imports to relative specifiers.
const to_relative_specifier = (specifier: string, dir: string, source_dir: string): string => {
	if (specifier.startsWith(MODULE_PATH_LIB_PREFIX)) {
		specifier = to_relative_specifier_trimmed_by(1, specifier, dir, source_dir);
	} else if (specifier.startsWith(MODULE_PATH_SRC_PREFIX)) {
		specifier = to_relative_specifier_trimmed_by(3, specifier, dir, source_dir);
	}
	return specifier;
};

const to_relative_specifier_trimmed_by = (
	chars_to_trim: number,
	specifier: string,
	dir: string,
	source_dir: string,
): string => {
	specifier = relative(dir, source_dir + specifier.substring(chars_to_trim));
	if (specifier[0] !== '.') specifier = './' + specifier;
	return specifier;
};

const parse_type_imports = (content: string): string[] =>
	Array.from(content.matchAll(/import\s+type[\s\S]*?from\s*['|"|\`](.+)['|"|\`]/gm)).map(
		(v) => v[1],
	);

// TODO is the `from` correct?
const parse_ts_imports_and_exports = (content: string): string[] =>
	Array.from(content.matchAll(/[import|export]\s[\s\S]*?from\s*['|"|\`](.+)['|"|\`]/gm)).map(
		(v) => v[1],
	);

// TODO upstream to felt probably
// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
const escape_regexp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const inject_svelte_css_import = (content: string, import_path: string, dev: boolean): string => {
	let newline_index = content.length;
	for (let i = 0; i < content.length; i++) {
		if (content[i] === '\n') {
			newline_index = i;
			break;
		}
	}
	const injected_css_loader_script = dev
		? `;globalThis.gro.register_css('${import_path}');`
		: `;import '${import_path}';`;
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
	dev: boolean,
): string => {
	const extension = extname(specifier);
	return !extension || !HACK_EXTENSIONLESS_EXTENSIONS.has(extension)
		? specifier + JS_EXTENSION
		: to_build_extension(specifier, dev);
};

// This hack is needed so we treat imports like `foo.task` as `foo.task.js`, not a `.task` file.
const HACK_EXTENSIONLESS_EXTENSIONS = new Set([SVELTE_EXTENSION, JS_EXTENSION, TS_EXTENSION]);
