import {z} from 'zod';
import {join} from 'node:path';
import {strip_start} from '@grogarden/util/string.js';
import type {Logger} from '@grogarden/util/log.js';
import {Project} from 'ts-morph';

import {paths, replace_extension} from './paths.js';
import {exists} from './fs.js';
import {
	transform_empty_object_to_undefined,
	type Package_Json,
	type Package_Json_Exports,
} from './package_json.js';

export const Src_Module_Declaration = z
	.object({
		name: z.string(), // the export identifier
		// TODO these are poorly named, and they're somewhat redundant with `kind`,
		// they were added to distinguish `VariableDeclaration` functions and non-functions
		kind: z.enum(['type', 'function', 'variable', 'class']).nullable(),
		// code: z.string(), // TODO experiment with `getType().getText()`, some of them return the same as `name`
	})
	.passthrough();
export type Src_Module_Declaration = z.infer<typeof Src_Module_Declaration>;

export const Src_Module = z
	.object({
		path: z.string(),
		declarations: z.array(Src_Module_Declaration),
	})
	.passthrough();
export type Src_Module = z.infer<typeof Src_Module>;

export const Src_Modules = z.record(Src_Module);
export type Src_Modules = z.infer<typeof Src_Modules>;

/**
 * @see https://github.com/grogarden/gro/blob/main/src/lib/docs/gro_plugin_sveltekit_app.md#well-known-src
 */
export const Src_Json = z.intersection(
	z.record(z.unknown()), // TODO is this what we want?
	z
		.object({
			name: z.string(), // same as Package_Json
			version: z.string(), // same as Package_Json
			modules: Src_Modules.transform(transform_empty_object_to_undefined).optional(),
		})
		.passthrough(),
);
export type Src_Json = z.infer<typeof Src_Json>;

export interface Map_Src_Json {
	(src_json: Src_Json): Src_Json | null | Promise<Src_Json | null>;
}

export const create_src_json = async (
	package_json: Package_Json,
	log?: Logger,
	lib_path?: string,
): Promise<Src_Json> => {
	return Src_Json.parse({
		name: package_json.name,
		version: package_json.version,
		modules: await to_src_modules(package_json.exports, log, lib_path),
	});
};

export const serialize_src_json = (src_json: Src_Json): string => {
	const parsed = Src_Json.parse(src_json); // TODO can parse do the logic that normalize does? see `.transform`
	return JSON.stringify(parsed, null, 2) + '\n';
};

export const to_src_modules = async (
	exports: Package_Json_Exports | undefined,
	log?: Logger,
	lib_path = paths.lib,
): Promise<Src_Modules | undefined> => {
	if (!exports) return undefined;

	const project = new Project();
	project.addSourceFilesAtPaths('src/**/*.ts'); // TODO dir? maybe rewrite with `lib_path`?

	return Object.fromEntries(
		(
			await Promise.all(
				Object.entries(exports).map(async ([k, _v]) => {
					// TODO hacky - doesn't handle any but the normal mappings, also add a helper?
					const source_file_path =
						k === '.' || k === './'
							? 'index.ts'
							: strip_start(k.endsWith('.js') ? replace_extension(k, '.ts') : k, './');
					if (!source_file_path.endsWith('.ts')) {
						// TODO support more than just TypeScript - maybe use @sveltejs/language-tools,
						// see how @sveltejs/package generates types, or maybe use its generated declaration files with ts-morph
						const src_module: Src_Module = {path: source_file_path, declarations: []};
						return [k, src_module];
					}
					const source_file_id = join(lib_path, source_file_path);
					if (!(await exists(source_file_id))) {
						log?.warn(
							'failed to infer source file from export path',
							k,
							'- the inferred file',
							source_file_id,
							'does not exist',
						);
						return null!;
					}

					const declarations: Src_Module_Declaration[] = [];

					const source_file = project.getSourceFile((f) =>
						f.getFilePath().endsWith(source_file_path),
					); // TODO expected this to work without the callback, according to my read of the docs it is, but `project.getSourceFile(source_file_path)` fails
					if (source_file) {
						for (const [name, decls] of source_file.getExportedDeclarations()) {
							if (!decls) continue;
							// TODO how to correctly handle multiples?
							for (const decl of decls) {
								// TODO helper
								const decl_type = decl.getType();
								const k = decl.getKindName();
								const kind =
									k === 'InterfaceDeclaration' || k === 'TypeAliasDeclaration'
										? 'type'
										: k === 'ClassDeclaration'
											? 'class'
											: k === 'VariableDeclaration'
												? decl_type.getCallSignatures().length
													? 'function'
													: 'variable' // TODO name?
												: null;
								// TODO
								// const code =
								// 	k === 'InterfaceDeclaration' || k === 'TypeAliasDeclaration'
								// 		? decl_type.getText(source_file) // TODO
								// 		: decl_type.getText(source_file);
								const found = declarations.find((d) => d.name === name);
								if (found) {
									// TODO hacky, this only was added to prevent `TypeAliasDeclaration` from overriding `VariableDeclaration`
									if (found.kind === 'type') {
										found.kind = kind;
										// found.code = code;
									}
								} else {
									// TODO more
									declarations.push({name, kind}); // code
								}
							}
						}
					}

					const src_module: Src_Module = {path: source_file_path, declarations};
					return [k, src_module];
				}),
			)
		).filter(Boolean),
	);
};
