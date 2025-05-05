import {z} from 'zod';
import {join, extname} from 'node:path';
import {ensure_end, strip_start} from '@ryanatkn/belt/string.js';
import {existsSync} from 'node:fs';
import ts from 'typescript';

import {paths, replace_extension} from './paths.ts';
import {
	transform_empty_object_to_undefined,
	type Package_Json,
	type Package_Json_Exports,
} from './package_json.ts';
import {parse_exports} from './parse_exports.ts';

export const Src_Module_Declaration_Kind = z.enum([
	'type',
	'function',
	'variable',
	'class',
	'component',
	'json',
	'css',
]);
export type Src_Module_Declaration_Kind = z.infer<typeof Src_Module_Declaration_Kind>;

// TODO @many rename to prefix with `Src_Json_`?
export const Src_Module_Declaration = z
	.object({
		name: z.string(), // the export identifier
		// TODO these are poorly named, and they're somewhat redundant with `kind`,
		// they were added to distinguish `VariableDeclaration` functions and non-functions
		kind: Src_Module_Declaration_Kind.nullable(),
		// code: z.string(), // TODO experiment with `getType().getText()`, some of them return the same as `name`
	})
	.passthrough();
export type Src_Module_Declaration = z.infer<typeof Src_Module_Declaration>;

// TODO @many rename to prefix with `Src_Json_`?
export const Src_Module = z
	.object({
		path: z.string(),
		declarations: z.array(Src_Module_Declaration),
	})
	.passthrough();
export type Src_Module = z.infer<typeof Src_Module>;

// TODO @many rename to prefix with `Src_Json_`?
export const Src_Modules = z.record(Src_Module);
export type Src_Modules = z.infer<typeof Src_Modules>;

/**
 * @see https://github.com/ryanatkn/gro/blob/main/src/docs/gro_plugin_sveltekit_app.md#well-known-src
 */
export const Src_Json = z
	.object({
		name: z.string(), // same as Package_Json
		version: z.string(), // same as Package_Json
		modules: Src_Modules.transform(transform_empty_object_to_undefined).optional(),
	})
	.passthrough();
export type Src_Json = z.infer<typeof Src_Json>;

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

		// Use parse_exports for all file types
		const declarations = parse_exports(file_path, program).map(({name, kind}) => ({
			name,
			kind: kind as Src_Module_Declaration_Kind | null,
		}));

		result[export_key] = {
			path: relative_path,
			declarations,
		};
	}

	return result;
};
