import ts from 'typescript';
import {extname} from 'node:path';
import type {Flavored} from '@ryanatkn/belt/types.js';

import type {Path_Id} from './path.ts';
import {TS_MATCHER} from './constants.ts';

export type Declaration_Kind =
	| 'type'
	| 'function'
	| 'variable'
	| 'class'
	| 'component'
	| 'json'
	| 'css'
	| 'primitive'; // TODO is this right? literal? maybe we need more properties to represent this?

export interface Declaration {
	name: string;
	kind: Declaration_Kind | null;
}

export type Export_Declaration = Flavored<Declaration, 'Export_Declaration'>;

/**
 * Parse exports from a file based on its file type and content.
 *
 * @mutates declarations
 */
export const parse_exports = (
	id: Path_Id,
	program?: ts.Program,
	declarations: Array<Export_Declaration> = [],
): Array<Export_Declaration> => {
	// First, infer declarations based on file extension
	infer_declarations_from_file_type(id, declarations);

	// For TypeScript files with program, perform detailed export analysis
	if (TS_MATCHER.test(id) && program) {
		const source_file = program.getSourceFile(id);
		if (!source_file) return declarations;

		const checker = program.getTypeChecker();

		// Get the exports of the source file (module)
		const symbol = checker.getSymbolAtLocation(source_file);
		if (!symbol) return declarations;

		// Get the module exports
		const exports = checker.getExportsOfModule(symbol);

		// Process TypeScript declarations
		process_ts_exports(source_file, checker, exports, declarations);
	}

	return declarations;
};

/**
 * Infer declarations based on file type.
 */
export const infer_declarations_from_file_type = (
	file_path: Path_Id,
	declarations: Array<Export_Declaration> = [],
): Array<Export_Declaration> => {
	const extension = extname(file_path).toLowerCase();

	switch (extension) {
		case '.svelte': {
			// For Svelte files, add a component declaration
			declarations.push({
				name: 'default',
				kind: 'component',
			});
			break;
		}
		case '.css': {
			// For CSS files, add a CSS declaration
			declarations.push({
				name: 'default',
				kind: 'css',
			});
			break;
		}
		case '.json': {
			// For JSON files, add a JSON declaration
			declarations.push({
				name: 'default',
				kind: 'json',
			});
			break;
		}
	}

	return declarations;
};

/**
 * Infer the declaration kind from a TypeScript node.
 */
export const get_declaration_kind = (node: ts.Node): Declaration_Kind | null => {
	if (ts.isVariableDeclaration(node)) {
		if (node.initializer) {
			if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
				return 'function';
			} else if (ts.isClassExpression(node.initializer)) {
				return 'class';
			}
		}
		return 'variable';
	} else if (ts.isFunctionDeclaration(node)) {
		return 'function';
	} else if (ts.isClassDeclaration(node)) {
		return 'class';
	} else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
		return 'type';
	}
	return null;
};

/**
 * Infer the kind of export from a symbol, considering its flags and possible aliasing.
 */
export const infer_kind_from_symbol = (
	symbol: ts.Symbol,
	checker: ts.TypeChecker,
	follow_alias = true,
): Declaration_Kind => {
	// If it's an alias and we should follow it
	if (follow_alias && symbol.flags & ts.SymbolFlags.Alias) {
		const aliased = checker.getAliasedSymbol(symbol);
		return infer_kind_from_symbol(aliased, checker, false);
	}

	// Determine the kind based on symbol flags
	if (symbol.flags & ts.SymbolFlags.TypeAlias || symbol.flags & ts.SymbolFlags.Interface) {
		return 'type';
	} else if (symbol.flags & ts.SymbolFlags.Class) {
		return 'class';
	} else if (symbol.flags & ts.SymbolFlags.Function || symbol.flags & ts.SymbolFlags.Method) {
		return 'function';
	} else {
		return 'variable';
	}
};

/**
 * Process TypeScript exports, identifying variables, functions, classes, and types.
 *
 * @mutates declarations
 */
export const process_ts_exports = (
	source_file: ts.SourceFile,
	checker: ts.TypeChecker,
	exports: Array<ts.Symbol>,
	declarations: Array<Export_Declaration> = [],
): Array<Export_Declaration> => {
	// Track exports by type (value vs type-only)
	const value_exports: Set<string> = new Set();
	const type_exports: Set<string> = new Set();

	// Track declaration kinds by name from the source code analysis
	const declaration_kinds: Map<string, Declaration_Kind> = new Map();

	// First pass: analyze source file to collect declarations and their kinds
	collect_declarations(source_file, declaration_kinds);

	// Second pass: collect export information (what's exported as value vs type)
	collect_export_info(source_file, value_exports, type_exports, declaration_kinds);

	// Process each exported symbol
	for (const export_symbol of exports) {
		const name = export_symbol.name;

		// Determine the export kind based on how it was exported (value vs type)
		const kind = determine_export_kind(
			name,
			export_symbol,
			checker,
			value_exports,
			type_exports,
			declaration_kinds,
		);

		declarations.push({
			name,
			kind,
		});
	}

	return declarations;
};

/**
 * Collect declarations from the source file and determine their kinds.
 *
 * When a symbol has multiple declarations (variable and type),
 * we prioritize the variable declaration to ensure correct handling
 * of dual purpose symbols.
 *
 * @mutates declaration_kinds
 */
const collect_declarations = (
	source_file: ts.SourceFile,
	declaration_kinds: Map<string, Declaration_Kind>,
): void => {
	// First collect all declarations
	const all_declarations: Map<string, Array<{node: ts.Node; kind: Declaration_Kind}>> = new Map();

	const register_declaration = (name: string, node: ts.Node, kind: Declaration_Kind) => {
		if (!all_declarations.has(name)) {
			all_declarations.set(name, []);
		}
		all_declarations.get(name)!.push({node, kind});
	};

	ts.forEachChild(source_file, (node) => {
		// Process variable declarations
		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) {
					const kind = get_declaration_kind(decl);
					if (kind) {
						register_declaration(decl.name.text, decl, kind);
					}
				}
			}
		}
		// Process function and class declarations
		else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				const kind = get_declaration_kind(node);
				if (kind) {
					register_declaration(node.name.text, node, kind);
				}
			}
		}
		// Process type and interface declarations
		else if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
			if (ts.isIdentifier(node.name)) {
				register_declaration(node.name.text, node, 'type');
			}
		}
	});

	// Then prioritize value declarations over type declarations
	for (const [name, declarations] of all_declarations.entries()) {
		// Check if this symbol has both value and type declarations
		const has_value_declaration = declarations.some((d) => d.kind !== 'type');
		const has_type_declaration = declarations.some((d) => d.kind === 'type');

		if (has_value_declaration) {
			// Prioritize non-type declarations in this order: variable, function, class
			const value_declaration =
				declarations.find((d) => d.kind === 'variable') ||
				declarations.find((d) => d.kind === 'function') ||
				declarations.find((d) => d.kind === 'class');

			if (value_declaration) {
				declaration_kinds.set(name, value_declaration.kind);
			}
		} else if (has_type_declaration) {
			declaration_kinds.set(name, 'type');
		}
	}
};

/**
 * Collect export information from the source file.
 * Identifies what symbols are exported as values vs types.
 *
 * @mutates value_exports
 * @mutates type_exports
 * @mutates declaration_kinds
 */
const collect_export_info = (
	source_file: ts.SourceFile,
	value_exports: Set<string>,
	type_exports: Set<string>,
	declaration_kinds: Map<string, Declaration_Kind>,
): void => {
	ts.forEachChild(source_file, (node) => {
		// Process export declarations (export { x } or export type { x })
		if (ts.isExportDeclaration(node)) {
			if (node.exportClause && ts.isNamedExports(node.exportClause)) {
				for (const element of node.exportClause.elements) {
					const export_name = element.name.text;
					const original_name = element.propertyName?.text || export_name;

					// Check if this is a type-only export
					if (node.isTypeOnly || element.isTypeOnly) {
						type_exports.add(export_name);
					} else {
						// For regular exports (not type-only), mark as value export
						value_exports.add(export_name);

						// For renamed exports, transfer the kind
						if (element.propertyName && declaration_kinds.has(original_name)) {
							declaration_kinds.set(export_name, declaration_kinds.get(original_name)!);
						}
					}
				}
			}
		}
		// Handle default exports (export default x)
		else if (ts.isExportAssignment(node) && !node.isExportEquals) {
			value_exports.add('default');

			// Determine the kind of the default export
			if (ts.isIdentifier(node.expression)) {
				const original_name = node.expression.text;
				if (declaration_kinds.has(original_name)) {
					declaration_kinds.set('default', declaration_kinds.get(original_name)!);
				}
			} else if (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression)) {
				declaration_kinds.set('default', 'function');
			} else if (ts.isClassExpression(node.expression)) {
				declaration_kinds.set('default', 'class');
			}
		}
		// Handle direct exports (export const x, export function x, export class X)
		else if (
			ts.isVariableStatement(node) ||
			ts.isFunctionDeclaration(node) ||
			ts.isClassDeclaration(node)
		) {
			if (node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
				if (ts.isVariableStatement(node)) {
					for (const decl of node.declarationList.declarations) {
						if (ts.isIdentifier(decl.name)) {
							value_exports.add(decl.name.text);
							const kind = get_declaration_kind(decl);
							if (kind) {
								declaration_kinds.set(decl.name.text, kind);
							}
						}
					}
				} else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
					value_exports.add(node.name.text);
					const kind = get_declaration_kind(node);
					if (kind) {
						declaration_kinds.set(node.name.text, kind);
					}
				}
			}
		}
		// Handle direct type exports (export type X, export interface X)
		else if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
			if (node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
				type_exports.add(node.name.text);
				declaration_kinds.set(node.name.text, 'type');
			}
		}
	});
};

/**
 * Determine the export kind for a symbol, considering various factors:
 * 1. Whether it's exported as a value or type
 * 2. Its declaration in the source code
 * 3. Symbol flags as a fallback
 */
const determine_export_kind = (
	name: string,
	symbol: ts.Symbol,
	checker: ts.TypeChecker,
	value_exports: Set<string>,
	type_exports: Set<string>,
	declaration_kinds: Map<string, Declaration_Kind>,
): Declaration_Kind | null => {
	// Check if the symbol has both a value and type declaration
	const is_type = symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface);
	const is_alias = symbol.flags & ts.SymbolFlags.Alias;

	// If this is a value export, we need special handling for dual purpose symbols
	if (value_exports.has(name)) {
		// Check if this is a dual purpose symbol (declared as both a value and a type)
		const has_dual_declaration = has_dual_purpose_declaration(symbol, checker);

		// Case 1: It's a dual purpose symbol exported as a value
		if (has_dual_declaration) {
			return 'variable'; // Always treat dual purpose symbols exported as values as variables
		}

		// Case 2: It's a normal value export
		if (declaration_kinds.has(name)) {
			return declaration_kinds.get(name)!;
		}

		// If it's an alias, check what it refers to
		if (is_alias) {
			const aliased = checker.getAliasedSymbol(symbol);
			if (aliased.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface)) {
				return 'type'; // It's an alias to a type
			}
		}

		// For pure type symbols (interfaces, type aliases) being exported as values
		if (is_type) {
			return 'type';
		}

		// Otherwise infer from symbol flags
		return infer_kind_from_symbol(symbol, checker);
	}

	// If it's only exported as a type, it's definitely a type
	if (type_exports.has(name)) {
		return 'type';
	}

	// As a fallback, infer from symbol flags
	return infer_kind_from_symbol(symbol, checker);
};

/**
 * Check if a symbol is dual purpose (has both value and type declarations).
 */
const has_dual_purpose_declaration = (symbol: ts.Symbol, checker: ts.TypeChecker): boolean => {
	// If it's an alias, check its target
	if (symbol.flags & ts.SymbolFlags.Alias) {
		const aliased = checker.getAliasedSymbol(symbol);
		return has_dual_purpose_declaration(aliased, checker);
	}

	// Check if the symbol has a value declaration
	const has_value = !!(
		symbol.valueDeclaration ||
		symbol.declarations?.some((d) => !ts.isTypeAliasDeclaration(d) && !ts.isInterfaceDeclaration(d))
	);

	// Check if the symbol has a type declaration
	const has_type = !!(
		symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface) ||
		symbol.declarations?.some((d) => ts.isTypeAliasDeclaration(d) || ts.isInterfaceDeclaration(d))
	);

	// It's dual purpose if it has both value and type declarations
	return has_value && has_type;
};
