import {z} from 'zod';
import {join} from 'node:path';
import {strip_start} from '@ryanatkn/belt/string.js';
import {existsSync, readFileSync} from 'node:fs';
import * as acorn from 'acorn';
import {tsPlugin} from '@sveltejs/acorn-typescript';
import {walk, type Context} from 'zimmerframe';
import type {Logger} from '@ryanatkn/belt/log.js';

import {paths, replace_extension} from './paths.ts';
import {
	transform_empty_object_to_undefined,
	type Package_Json,
	type Package_Json_Exports,
} from './package_json.ts';

let _parser: typeof acorn.Parser | undefined;
const ts_parser = (): typeof acorn.Parser => (_parser ??= acorn.Parser.extend(tsPlugin()));

// TODO @many rename to prefix with `Src_Json_`?
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

export const create_src_json = (
	package_json: Package_Json,
	lib_path?: string,
	log?: Logger,
): Src_Json =>
	Src_Json.parse({
		name: package_json.name,
		version: package_json.version,
		modules: to_src_modules(package_json.exports, lib_path, log),
	});

export const serialize_src_json = (src_json: Src_Json): string => {
	const parsed = Src_Json.parse(src_json); // TODO can parse do the logic that normalize does? see `.transform`
	return JSON.stringify(parsed, null, 2) + '\n';
};

export const to_src_modules = (
	exports: Package_Json_Exports | undefined,
	lib_path = paths.lib,
	log?: Logger,
): Src_Modules | undefined => {
	if (!exports) return;

	return Object.fromEntries(
		Object.entries(exports).map(([k, _v]) => {
			// TODO hacky - doesn't handle any but the typical mappings, also add a helper?
			const source_file_path =
				k === '.' || k === './'
					? 'index.ts'
					: strip_start(k.endsWith('.js') ? replace_extension(k, '.ts') : k, './');
			if (!source_file_path.endsWith('.ts')) {
				// TODO support more than just TypeScript - maybe use @sveltejs/language-tools,
				// see how @sveltejs/package generates types, or maybe use its generated declaration files
				const src_module: Src_Module = {path: source_file_path, declarations: []};
				return [k, src_module];
			}
			const source_file_id = join(lib_path, source_file_path);
			if (!existsSync(source_file_id)) {
				throw Error(
					`Failed to infer source file from package.json export path ${k} - the inferred file ${source_file_id} does not exist`,
				);
			}

			// Track declarations and exports
			interface ParseState {
				// Maps symbol names to their declaration type
				local_declarations: Map<string, string>;
				// Maps exported names to their export information (both value and type)
				exports: Map<
					string,
					{
						name: string;
						kind: string | null;
						export_kind: 'value' | 'type' | 'both';
						// For aliased exports, track the original name and if it's explicitly a type export
						is_explicit_alias?: boolean;
						original_name?: string;
					}
				>;
			}

			const state: ParseState = {
				local_declarations: new Map(),
				exports: new Map(),
			};

			const contents = readFileSync(source_file_id, 'utf-8');

			try {
				// Parse the file using acorn-typescript
				const parsed = ts_parser().parse(contents, {
					sourceType: 'module',
					ecmaVersion: 'latest',
					locations: true,
				});

				// First collect all declarations in the file
				walk(parsed, state, {
					VariableDeclaration(
						node: acorn.VariableDeclaration,
						{state, next}: Context<acorn.VariableDeclaration, ParseState>,
					) {
						for (const declarator of node.declarations) {
							if (declarator.id.type === 'Identifier') {
								const name = declarator.id.name;
								let kind = 'variable';

								// Determine if it's a function
								if (
									declarator.init &&
									(declarator.init.type === 'ArrowFunctionExpression' ||
										declarator.init.type === 'FunctionExpression')
								) {
									kind = 'function';
								}

								state.local_declarations.set(name, kind);
							}
						}
						next();
					},

					FunctionDeclaration(
						node: acorn.FunctionDeclaration,
						{state, next}: Context<acorn.FunctionDeclaration, ParseState>,
					) {
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
						if (node.id && node.id.type === 'Identifier') {
							state.local_declarations.set(node.id.name, 'function');
						}
						next();
					},

					ClassDeclaration(
						node: acorn.ClassDeclaration,
						{state, next}: Context<acorn.ClassDeclaration, ParseState>,
					) {
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
						if (node.id && node.id.type === 'Identifier') {
							state.local_declarations.set(node.id.name, 'class');
						}
						next();
					},

					TSInterfaceDeclaration(node: any, {state, next}: Context<Node, ParseState>) {
						if (node.id && node.id.type === 'Identifier') {
							state.local_declarations.set(node.id.name, 'type');
						}
						next();
					},

					TSTypeAliasDeclaration(node: any, {state, next}: Context<Node, ParseState>) {
						if (node.id && node.id.type === 'Identifier') {
							state.local_declarations.set(node.id.name, 'type');
						}
						next();
					},
				} as any);

				// Now extract exports
				walk(parsed, state, {
					ExportNamedDeclaration(
						node: acorn.ExportNamedDeclaration,
						{state}: Context<Node, ParseState>,
					) {
						// Check if this is a type export
						const is_type_export = (node as any).exportKind === 'type';

						// Handle direct exports (e.g. export const x = 1, export type T = ...)
						if (node.declaration) {
							if (node.declaration.type === 'VariableDeclaration') {
								for (const declarator of node.declaration.declarations) {
									if (declarator.id.type === 'Identifier') {
										const name = declarator.id.name;
										let kind = 'variable';

										// Determine if it's a function
										if (
											declarator.init &&
											(declarator.init.type === 'ArrowFunctionExpression' ||
												declarator.init.type === 'FunctionExpression')
										) {
											kind = 'function';
										}

										// Add as value export
										state.exports.set(name, {
											name,
											kind,
											export_kind: 'value',
										});
									}
								}
							} else if (
								(node.declaration as any).type === 'TSTypeAliasDeclaration' ||
								(node.declaration as any).type === 'TSInterfaceDeclaration'
							) {
								const name = (node.declaration as any).id.name;
								state.exports.set(name, {
									name,
									kind: 'type',
									export_kind: 'type',
								});
							} else if (node.declaration.type === 'ClassDeclaration') {
								const name = node.declaration.id.name;
								state.exports.set(name, {
									name,
									kind: 'class',
									export_kind: 'value',
								});
								// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
							} else if (node.declaration.type === 'FunctionDeclaration') {
								const name = node.declaration.id.name;
								state.exports.set(name, {
									name,
									kind: 'function',
									export_kind: 'value',
								});
							}
						}
						// Handle export specifiers (export {x, y} or export type {x, y})
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
						else if (node.specifiers && node.specifiers.length > 0) {
							for (const specifier of node.specifiers) {
								// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
								if (specifier.type === 'ExportSpecifier') {
									const local_name = (specifier.local as any).name;
									const exported_name = (specifier.exported as any).name;

									// Check if this is a type export
									const specifier_is_type = (specifier as any).exportKind === 'type';
									const is_type_export = (node as any).exportKind === 'type' || specifier_is_type;

									// Get the declaration kind from local declarations
									const local_declaration_kind = state.local_declarations.get(local_name);

									// Check for existing export declaration
									const existing = state.exports.get(exported_name);

									// If it's a type export, mark it as a type
									if (is_type_export) {
										if (existing) {
											// If it already exists as a value export, mark it as both
											existing.export_kind = existing.export_kind === 'value' ? 'both' : 'type';
										} else {
											state.exports.set(exported_name, {
												name: exported_name,
												kind: 'type',
												export_kind: 'type',
												original_name: local_name,
											});
										}
									} else {
										// For value exports, preserve the original declaration kind if possible
										if (existing) {
											existing.export_kind = existing.export_kind === 'type' ? 'both' : 'value';
											// For value exports, preserve the original declaration kind if possible
											if (local_declaration_kind) {
												existing.kind = local_declaration_kind;
											}
										} else {
											state.exports.set(exported_name, {
												name: exported_name,
												kind: local_declaration_kind || 'variable',
												export_kind: 'value',
												original_name: local_name,
											});
										}
									}
								}
							}
						}
					},

					ExportDefaultDeclaration(
						node: acorn.ExportDefaultDeclaration,
						{state}: Context<Node, ParseState>,
					) {
						// Default exports are always value exports
						if (node.declaration) {
							if (node.declaration.type === 'Identifier') {
								const local_name = node.declaration.name;
								const kind = state.local_declarations.get(local_name) || 'variable';
								state.exports.set('default', {
									name: 'default',
									kind,
									export_kind: 'value',
									original_name: local_name,
								});
							} else if (node.declaration.type === 'ClassDeclaration') {
								state.exports.set('default', {
									name: 'default',
									kind: 'class',
									export_kind: 'value',
								});
							} else if (node.declaration.type === 'FunctionDeclaration') {
								state.exports.set('default', {
									name: 'default',
									kind: 'function',
									export_kind: 'value',
								});
							} else if (
								node.declaration.type === 'ArrowFunctionExpression' ||
								node.declaration.type === 'FunctionExpression'
							) {
								state.exports.set('default', {
									name: 'default',
									kind: 'function',
									export_kind: 'value',
								});
							} else {
								state.exports.set('default', {
									name: 'default',
									kind: 'variable',
									export_kind: 'value',
								});
							}
						} else {
							state.exports.set('default', {
								name: 'default',
								kind: 'variable',
								export_kind: 'value',
							});
						}
					},
				} as any);

				// Process exported declarations to apply final precedence rules
				const declarations: Src_Module['declarations'] = Array.from(state.exports.values()).map(
					({name, kind, export_kind, original_name}) => {
						let final_kind = kind;

						// When something is exported as a value (not as a type), we should ensure it's not treated as a type
						if (export_kind === 'value') {
							// For regular exports, use the local declaration kind if available
							const local_name = original_name || name;
							const local_kind = state.local_declarations.get(local_name);

							// If we have a local declaration that's not a type, use that
							if (local_kind && local_kind !== 'type') {
								final_kind = local_kind;
							} else {
								// Default to variable for value exports with no non-type declaration
								final_kind = 'variable';
							}
						}
						// For type-only exports, ensure it's marked as a type
						else if (export_kind === 'type') {
							final_kind = 'type';
						}
						// For both value and type exports, value takes precedence
						else if (export_kind === 'both') {
							// If there's a non-type local declaration, use that
							const local_name = original_name || name;
							const local_kind = state.local_declarations.get(local_name);

							if (local_kind && local_kind !== 'type') {
								final_kind = local_kind;
							} else {
								// Default to variable if no non-type declaration exists
								final_kind = 'variable';
							}
						}

						return {
							name,
							kind: final_kind as any,
						};
					},
				);

				const src_module: Src_Module = {path: source_file_path, declarations};
				return [k, src_module];
			} catch (err) {
				// If parsing fails, return an empty declarations array rather than crashing
				log?.error(`Failed to parse ${source_file_id}:`, err.message);
				const src_module: Src_Module = {path: source_file_path, declarations: []};
				return [k, src_module];
			}
		}),
	);
};
