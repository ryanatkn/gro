import {join, extname} from 'node:path';
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

export const to_src_modules = (
	exports: Package_Json_Exports | undefined,
	lib_path = paths.lib,
): Src_Modules | undefined => {
	if (!exports) return;

	// Prepare a list of files to analyze
	const file_paths: Array<{export_key: string; file_path: string}> = [];

	for (const [k, _v] of Object.entries(exports)) {
		// Skip package.json
		if (k === './package.json') continue;

		// Check if this is a pattern export
		if (k.includes('*')) {
			// Handle pattern exports by finding matching files in lib
			const pattern = strip_start(k, './');

			// Determine the source extension based on pattern
			let source_pattern: string;
			if (pattern.endsWith('*.js')) {
				source_pattern = pattern.replace('*.js', '*.ts');
			} else {
				source_pattern = pattern;
			}

			// Find matching files in lib directory
			const matching_files = search_fs(lib_path, {
				file_filter: (path) => {
					const relative = path.replace(ensure_end(lib_path, '/'), '');
					// Only match files in the root directory (no subdirectories)
					if (relative.includes('/')) return false;

					// Match the pattern (simple wildcard matching)
					if (source_pattern === '*.ts') {
						return TS_MATCHER.test(relative) && !relative.endsWith('.d.ts') && !relative.endsWith('.test.ts');
					} else if (source_pattern === '*.svelte') {
						return SVELTE_MATCHER.test(relative);
					} else if (source_pattern === '*.json') {
						return JSON_MATCHER.test(relative);
					} else if (source_pattern === '*.css') {
						return CSS_MATCHER.test(relative);
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
			const source_file_path =
				k === '.' || k === './'
					? 'index.ts'
					: strip_start(k.endsWith('.js') ? replace_extension(k, '.ts') : k, './');

			const source_file_id = join(lib_path, source_file_path);

			// Check if file exists
			if (!existsSync(source_file_id)) {
				// Handle non-TypeScript files (Svelte, CSS, JSON)
				const extension = extname(source_file_id);
				if (extension === '.svelte' || extension === '.css' || extension === '.json') {
					file_paths.push({export_key: k, file_path: source_file_id});
					continue;
				}

				// TODO still an error for unknown files running `gro gen`, can it use the filer to invalidate correctly?
				throw Error(
					`Failed to infer source file from package.json export path ${k} - the inferred file ${source_file_id} does not exist`,
				);
			}

			file_paths.push({export_key: k, file_path: source_file_id});
		}
	}

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
