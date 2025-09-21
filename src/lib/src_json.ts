import {join} from 'node:path';
import {ensure_end, strip_start} from '@ryanatkn/belt/string.js';
import {existsSync} from 'node:fs';
import ts from 'typescript';
import type {Package_Json, Package_Json_Exports} from '@ryanatkn/belt/package_json.js';
import {Src_Json, Src_Modules} from '@ryanatkn/belt/src_json.js';

import {paths, replace_extension} from './paths.ts';
import {parse_exports} from './parse_exports.ts';
import {TS_MATCHER, SVELTE_MATCHER, JSON_MATCHER, CSS_MATCHER} from './constants.ts';
import {search_fs} from './search_fs.ts';

export type Map_Src_Json = (src_json: Src_Json) => Src_Json | null | Promise<Src_Json | null>;

export const create_src_json = (package_json: Package_Json, lib_path?: string): Src_Json =>
	Src_Json.parse({
		name: package_json.name,
		version: package_json.version,
		modules: to_src_modules(package_json.exports, lib_path),
	});

export const serialize_src_json = (src_json: Src_Json): string => {
	const parsed = Src_Json.parse(src_json); // TODO can parse do the logic that normalize does? see `.transform`
	return JSON.stringify(parsed, null, 2) + '\n';
};

const infer_source_from_export = (export_path: string, lib_path: string): string | null => {
	// Handle index specially
	if (export_path === '.' || export_path === './') {
		const index_ts = join(lib_path, 'index.ts');
		if (existsSync(index_ts)) return index_ts;
		const index_js = join(lib_path, 'index.js');
		if (existsSync(index_js)) return index_js;
		return null;
	}

	const clean_path = strip_start(export_path, './');

	// For .js exports, try .ts first
	if (clean_path.endsWith('.js')) {
		const ts_path = join(lib_path, replace_extension(clean_path, '.ts'));
		if (existsSync(ts_path)) return ts_path;
	}

	// Try the exact path
	const exact_path = join(lib_path, clean_path);
	if (existsSync(exact_path)) return exact_path;

	return null;
};

const collect_file_paths = (
	exports: Package_Json_Exports,
	lib_path: string,
): Array<{export_key: string; file_path: string}> => {
	const file_paths: Array<{export_key: string; file_path: string}> = [];

	// Handle string exports (single default export)
	if (typeof exports === 'string') {
		const source_file = infer_source_from_export(exports, lib_path);
		if (source_file) {
			file_paths.push({export_key: '.', file_path: source_file});
		} else {
			throw Error(
				`Failed to infer source file from package.json string export "${exports}" - no matching file found in ${lib_path}`,
			);
		}
		return file_paths;
	}

	// Handle object exports
	for (const k in exports) {
		// Skip package.json
		if (k === './package.json') continue;

		// Check if this is a pattern export
		if (k.includes('*')) {
			// Handle pattern exports by finding matching files in lib
			const matching_files = search_fs(lib_path, {
				file_filter: (path) => {
					const p = path.replace(ensure_end(lib_path, '/'), '');
					// Only match files in the root directory (no subdirectories)
					if (p.includes('/')) return false;

					// Match based on the export pattern
					if (k === './*.js') {
						return TS_MATCHER.test(p) && !p.endsWith('.d.ts') && !p.endsWith('.test.ts');
					} else if (k === './*.svelte') {
						return SVELTE_MATCHER.test(p);
					} else if (k === './*.json') {
						return JSON_MATCHER.test(p);
					} else if (k === './*.css') {
						return CSS_MATCHER.test(p);
					}
					return false;
				},
			});

			// Add each matching file
			for (const file of matching_files) {
				let export_path: string;
				if (file.path.endsWith('.ts')) {
					export_path = './' + file.path.replace('.ts', '.js');
				} else {
					export_path = './' + file.path;
				}
				file_paths.push({export_key: export_path, file_path: file.id});
			}
		} else {
			// Handle explicit exports (non-patterns)
			const source_file = infer_source_from_export(k, lib_path);
			if (source_file) {
				file_paths.push({export_key: k, file_path: source_file});
			} else {
				throw Error(
					`Failed to infer source file from package.json export path ${k} - no matching file found in ${lib_path}`,
				);
			}
		}
	}

	return file_paths;
};

export const to_src_modules = (
	exports: Package_Json_Exports | undefined,
	lib_path = paths.lib,
): Src_Modules | undefined => {
	if (!exports) return;

	const file_paths = collect_file_paths(exports, lib_path);

	// Create a TypeScript program for all TypeScript files
	const ts_files = file_paths
		.filter(({file_path}) => TS_MATCHER.test(file_path))
		.map(({file_path}) => file_path);

	let program: ts.Program | undefined;
	if (ts_files.length > 0) {
		program = ts.createProgram(
			ts_files,
			// TODO get from tsconfig?
			{
				target: ts.ScriptTarget.ESNext,
				module: ts.ModuleKind.ESNext,
				moduleResolution: ts.ModuleResolutionKind.NodeNext,
				verbatimModuleSyntax: true,
				isolatedModules: true,
			},
		);
	}

	const result: Src_Modules = {};

	// Process each file
	for (const {export_key, file_path} of file_paths) {
		const relative_path = file_path.replace(ensure_end(lib_path, '/'), '');

		const declarations = parse_exports(file_path, program).map(({name, kind}) => ({name, kind}));

		result[export_key] = declarations.length
			? {
					path: relative_path,
					declarations,
				}
			: {
					path: relative_path,
				};
	}

	return result;
};
