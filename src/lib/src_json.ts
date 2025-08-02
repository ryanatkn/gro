import {join, extname} from 'node:path';
import {ensure_end, strip_start} from '@ryanatkn/belt/string.js';
import {existsSync} from 'node:fs';
import ts from 'typescript';
import type {Package_Json, Package_Json_Exports} from '@ryanatkn/belt/package_json.js';
import {Src_Json, Src_Modules} from '@ryanatkn/belt/src_json.js';

import {paths, replace_extension} from './paths.ts';
import {parse_exports} from './parse_exports.ts';

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
		// Handle different file types
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

			throw Error(
				`Failed to infer source file from package.json export path ${k} - the inferred file ${source_file_id} does not exist`,
			);
		}

		file_paths.push({export_key: k, file_path: source_file_id});
	}

	// Create a TypeScript program for all TypeScript files
	const ts_files = file_paths
		.filter(({file_path}) => file_path.endsWith('.ts') || file_path.endsWith('.tsx'))
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
