import {z} from 'zod';
import {join} from 'node:path';
import {strip_start} from '@ryanatkn/belt/string.js';
import {existsSync} from 'node:fs';
import * as ts from 'typescript';
import type {Logger} from '@ryanatkn/belt/log.js';

import {paths, replace_extension} from './paths.ts';
import {
	transform_empty_object_to_undefined,
	type Package_Json,
	type Package_Json_Exports,
} from './package_json.ts';

export const Src_Module_Declaration_Kind = z.enum(['type', 'function', 'variable', 'class']);
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

	// Prepare a list of files to analyze
	const file_paths: Array<{export_key: string; ts_path: string}> = [];
	for (const [k, _v] of Object.entries(exports)) {
		// TODO hacky - doesn't handle any but the typical mappings, also add a helper?
		const source_file_path =
			k === '.' || k === './'
				? 'index.ts'
				: strip_start(k.endsWith('.js') ? replace_extension(k, '.ts') : k, './');

		if (!source_file_path.endsWith('.ts')) {
			// TODO support more than just TypeScript
			continue;
		}

		const source_file_id = join(lib_path, source_file_path);
		if (!existsSync(source_file_id)) {
			throw Error(
				`Failed to infer source file from package.json export path ${k} - the inferred file ${source_file_id} does not exist`,
			);
		}

		file_paths.push({export_key: k, ts_path: source_file_id});
	}

	// Create a TypeScript program for all the files
	const program = ts.createProgram(
		file_paths.map((f) => f.ts_path),
		{
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
		},
	);

	// Get the type checker
	const checker = program.getTypeChecker();

	const result: Src_Modules = {};

	// Process each file
	for (const {export_key, ts_path} of file_paths) {
		const source_file = program.getSourceFile(ts_path);
		if (!source_file) {
			log?.error(`Could not load source file ${ts_path}`);
			continue;
		}

		const relative_path = ts_path.replace(lib_path, '').replace(/^\//, '');
		const declarations: Array<Src_Module_Declaration> = [];

		// Process the exports in the file
		process_exports(source_file, checker, declarations);

		result[export_key] = {
			path: relative_path,
			declarations,
		};
	}

	return result;
};

/**
 * Process exports in a source file, collecting declarations.
 */
const process_exports = (
	source_file: ts.SourceFile,
	checker: ts.TypeChecker,
	declarations: Array<Src_Module_Declaration>,
): void => {
	// Get the exports of the source file (module)
	const symbol = checker.getSymbolAtLocation(source_file);
	if (!symbol) return;

	// Get the module exports
	const exports = checker.getExportsOfModule(symbol);

	// Track type exports (from explicit 'export type' statements)
	const type_exports: Set<string> = new Set();

	// Track value exports (from explicit 'export' without 'type' keyword)
	const value_exports: Set<string> = new Set();

	// Track arrow functions specifically to ensure they're properly identified
	const arrow_function_exports: Set<string> = new Set();

	// First pass: collect all exports and their kinds
	ts.forEachChild(source_file, (node) => {
		if (ts.isExportDeclaration(node)) {
			if (node.exportClause && ts.isNamedExports(node.exportClause)) {
				for (const element of node.exportClause.elements) {
					// Get the exported name (which might be an alias)
					const export_name = element.name.text;

					// Check if this is a type-only export
					if (node.isTypeOnly) {
						type_exports.add(export_name);
					} else if (element.isTypeOnly) {
						// Handle `export {type X}` case - element-specific type export
						type_exports.add(export_name);
					} else {
						// For regular exports (not type-only), it's definitely a value export
						value_exports.add(export_name);

						// Try to determine if it's an arrow function
						if (element.propertyName) {
							// Find the original declaration in the source file
							const original_name = element.propertyName.text;
							ts.forEachChild(source_file, (declaration_node) => {
								if (ts.isVariableStatement(declaration_node)) {
									for (const decl of declaration_node.declarationList.declarations) {
										if (
											ts.isIdentifier(decl.name) &&
											decl.name.text === original_name &&
											decl.initializer &&
											ts.isArrowFunction(decl.initializer)
										) {
											arrow_function_exports.add(export_name);
										}
									}
								}
							});
						}
					}
				}
			}
		} else if (ts.isExportAssignment(node) && !node.isExportEquals) {
			// Handle default exports
			value_exports.add('default');

			// Check if default export is an arrow function
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			if (node.expression && ts.isArrowFunction(node.expression)) {
				arrow_function_exports.add('default');
			}
		} else if (
			ts.isVariableStatement(node) ||
			ts.isFunctionDeclaration(node) ||
			ts.isClassDeclaration(node)
		) {
			// Handle direct exports like 'export const/function/class'
			if (node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
				if (ts.isVariableStatement(node)) {
					for (const decl of node.declarationList.declarations) {
						if (ts.isIdentifier(decl.name)) {
							value_exports.add(decl.name.text);

							// Check if this is an arrow function
							if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
								arrow_function_exports.add(decl.name.text);
							} else if (decl.initializer) {
								// For function expressions or other function-like initializers
								try {
									const decl_type = checker.getTypeAtLocation(decl.initializer);
									if (decl_type.getCallSignatures().length > 0) {
										arrow_function_exports.add(decl.name.text);
									}
								} catch (_error) {
									// If we can't get the type, continue with other checks
								}
							}
						}
					}
				} else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
					value_exports.add(node.name.text);
					if (ts.isFunctionDeclaration(node)) {
						arrow_function_exports.add(node.name.text);
					}
				}
			}
		} else if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
			// Handle direct type exports like 'export type/interface'
			if (node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
				type_exports.add(node.name.text);
			}
		}
	});

	// Process each export
	for (const export_symbol of exports) {
		const name = export_symbol.name;

		// Determine the export kind with strict precedence rules
		let kind: Src_Module_Declaration_Kind | null = null;

		// Priority 1: If it's explicitly exported with 'export' without 'type' keyword, it should be a value
		if (value_exports.has(name)) {
			// First check if we've already determined it's an arrow function
			if (arrow_function_exports.has(name)) {
				kind = 'function';
			}
			// Then check if it's a class
			else if (export_symbol.flags & ts.SymbolFlags.Class) {
				kind = 'class';
			}
			// Then check if it's a standard function
			else if (export_symbol.flags & ts.SymbolFlags.Function) {
				kind = 'function';
			}
			// For value exports that aren't already determined, follow aliases and determine the kind
			else {
				// If it's an alias, follow it to get the actual kind
				if (export_symbol.flags & ts.SymbolFlags.Alias) {
					const aliased = checker.getAliasedSymbol(export_symbol);

					// Get the kind, including function detection
					kind = determine_declaration_kind(checker, aliased, export_symbol.declarations?.[0]);

					// Ensure values without specific function/class detection are marked as variables
					// This is important for dual declarations like Dual_Export
					if (kind !== 'function' && kind !== 'class') {
						kind = 'variable';
					}
				} else {
					// For non-aliases, determine directly
					kind = determine_declaration_kind(
						checker,
						export_symbol,
						export_symbol.declarations?.[0],
					);

					// Enforce that any value export without a specific function/class detection
					// is treated as a variable regardless of other declarations
					if (kind !== 'function' && kind !== 'class') {
						kind = 'variable';
					}
				}
			}
		}
		// Priority 2: If it's explicitly exported with 'export type', always treat as type
		else if (type_exports.has(name)) {
			kind = 'type';
		}
		// Priority 3: If it's an Interface, it must be a type
		else if (export_symbol.flags & ts.SymbolFlags.Interface) {
			kind = 'type';
		}
		// Priority 4: If it's a TypeAlias, it must be a type
		else if (export_symbol.flags & ts.SymbolFlags.TypeAlias) {
			kind = 'type';
		}
		// Priority 5: If it's a class
		else if (export_symbol.flags & ts.SymbolFlags.Class) {
			kind = 'class';
		}
		// Priority 6: If it's an alias, follow it
		else if (export_symbol.flags & ts.SymbolFlags.Alias) {
			const aliased = checker.getAliasedSymbol(export_symbol);

			// Special handling for interfaces and type aliases
			if (aliased.flags & ts.SymbolFlags.Interface || aliased.flags & ts.SymbolFlags.TypeAlias) {
				kind = 'type';
			} else {
				kind = determine_declaration_kind(checker, aliased, export_symbol.declarations?.[0]);
			}
		}
		// Priority 7: Other kinds of exports
		else {
			kind = determine_declaration_kind(checker, export_symbol);
		}

		declarations.push({
			name,
			kind,
		});
	}
};

/**
 * Determines the declaration kind based on TypeScript node and type information.
 */
const determine_declaration_kind = (
	checker: ts.TypeChecker,
	symbol: ts.Symbol,
	node?: ts.Node,
): Src_Module_Declaration_Kind | null => {
	// Handle type exports
	if (symbol.flags & ts.SymbolFlags.Type && !(symbol.flags & ts.SymbolFlags.Class)) {
		return 'type';
	}

	// Handle class exports - check for class flag or constructor signature
	if (symbol.flags & ts.SymbolFlags.Class) {
		return 'class';
	}

	// For exports with valueDeclaration - check if it's a class or function
	if (symbol.valueDeclaration) {
		const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);

		// Check if it has constructSignatures - this is a reliable way to identify classes
		if (type.getConstructSignatures().length > 0) {
			return 'class';
		}

		// Check if the symbol has members with a prototype - another class indicator
		if (symbol.members?.size && symbol.members.has(ts.escapeLeadingUnderscores('prototype'))) {
			return 'class';
		}

		// Check if it has call signatures - identifying both regular and arrow functions
		if (type.getCallSignatures().length > 0) {
			return 'function';
		}

		// For arrow functions in variable declarations
		if (ts.isVariableDeclaration(symbol.valueDeclaration) && symbol.valueDeclaration.initializer) {
			const initializer = symbol.valueDeclaration.initializer;

			// Check if the initializer is an arrow function or function expression
			if (
				ts.isArrowFunction(initializer) ||
				ts.isFunctionExpression(initializer) ||
				ts.isMethodDeclaration(initializer)
			) {
				return 'function';
			}

			// For more complex initializers, examine the type
			try {
				const init_type = checker.getTypeAtLocation(initializer);
				if (init_type.getCallSignatures().length > 0) {
					return 'function';
				}
			} catch (_error) {
				// If we can't get the type, continue with other checks
			}
		}
	}

	// Handle function exports - need to check the type signature
	if (symbol.valueDeclaration) {
		// Get the type of the symbol at its declaration site
		const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);

		// Check if it's a function type
		const is_function_type =
			(type.flags & ts.TypeFlags.Object) !== 0 && type.getCallSignatures().length > 0;

		if (symbol.flags & ts.SymbolFlags.Function || is_function_type) {
			return 'function';
		}

		// For export aliases, we need to check if they point to a function or class
		if (symbol.flags & ts.SymbolFlags.Alias) {
			const target_symbol = checker.getAliasedSymbol(symbol);

			// First check if the aliased symbol is a class
			if (target_symbol.flags & ts.SymbolFlags.Class) {
				return 'class';
			}

			// Check if target has a valueDeclaration - important for checking class and function types
			if (target_symbol.valueDeclaration) {
				const target_type = checker.getTypeOfSymbolAtLocation(
					target_symbol,
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					target_symbol.valueDeclaration || node || symbol.valueDeclaration,
				);

				// Check for class by looking for constructor signatures
				if (target_type.getConstructSignatures().length > 0) {
					return 'class';
				}

				// Check for function
				if (
					(target_symbol.flags & ts.SymbolFlags.Function) !== 0 ||
					((target_type.flags & ts.TypeFlags.Object) !== 0 &&
						target_type.getCallSignatures().length > 0)
				) {
					return 'function';
				}

				// Check if the target value declaration is a variable with an arrow function initializer
				if (
					ts.isVariableDeclaration(target_symbol.valueDeclaration) &&
					target_symbol.valueDeclaration.initializer &&
					ts.isArrowFunction(target_symbol.valueDeclaration.initializer)
				) {
					return 'function';
				}
			}
		}
	}

	// Special case for direct exports of arrow functions
	if (node && ts.isExportSpecifier(node)) {
		// Try to find the original declaration of the exported symbol
		const local_symbol = checker.getExportSpecifierLocalTargetSymbol(node);
		if (local_symbol?.valueDeclaration) {
			// Check if it's a variable declaration with an arrow function initializer
			if (
				ts.isVariableDeclaration(local_symbol.valueDeclaration) &&
				local_symbol.valueDeclaration.initializer &&
				ts.isArrowFunction(local_symbol.valueDeclaration.initializer)
			) {
				return 'function';
			}

			// Check the type for call signatures
			try {
				const type = checker.getTypeOfSymbolAtLocation(local_symbol, local_symbol.valueDeclaration);
				if (type.getCallSignatures().length > 0) {
					return 'function';
				}
			} catch (_error) {
				// If we can't get the type, continue with other checks
			}
		}
	}

	// Default to variable for value exports
	return 'variable';
};
