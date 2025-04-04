import {parseSync, type DynamicImport, type StaticImport, type ImportDeclaration} from 'oxc-parser';
import type {Flavored} from '@ryanatkn/belt/types.js';

import type {Path_Id} from './path.js';
import {SVELTE_MATCHER} from './svelte_helpers.js';
import {JS_MATCHER, TS_MATCHER} from './constants.js';

export type Import_Specifier = Flavored<string, 'Import_Specifier'>;

const script_matcher = /<script.*?>(.*?)<\/script>/gimsu;

export const parse_imports = (
	id: Path_Id,
	contents: string,
	ignore_types = true,
): Array<Import_Specifier> => {
	const specifiers: Array<string> = [];

	// Helper function to process both static and dynamic imports
	const process_import = (
		import_node: StaticImport | DynamicImport,
		sourceCode: string,
		ast_node?: ImportDeclaration, // Added to check importKind for static imports
	) => {
		// Skip type-only imports if ignore_types is true
		if (
			ignore_types &&
			ast_node && // Check if it's a static import (ast_node is provided)
			ast_node.importKind === 'type' // Check if the import declaration itself is type-only
		) {
			return;
		}

		// TODO handle `import {type foo} from './bar.js'` - need to check `import_node.entries`?

		const value = sourceCode.substring(
			import_node.moduleRequest.start + 1,
			import_node.moduleRequest.end - 1,
		);
		if (value) {
			specifiers.push(value);
		}
	};

	const is_svelte = SVELTE_MATCHER.test(id);

	const parse_from = (s: string): void => {
		const parsed = parseSync(is_svelte ? id + '.ts' : id, s, {});

		// Create a map of static import start positions to their AST nodes for quick lookup
		const static_import_ast_nodes: Map<number, ImportDeclaration> = new Map();
		for (const node of parsed.program.body) {
			if (node.type === 'ImportDeclaration') {
				static_import_ast_nodes.set(node.start, node);
			}
		}

		// Process static imports
		for (const p of parsed.module.staticImports) {
			const ast_node = static_import_ast_nodes.get(p.start);
			process_import(p, s, ast_node); // Pass the corresponding AST node
		}

		// Process dynamic imports
		for (const p of parsed.module.dynamicImports) {
			process_import(p, s); // No AST node needed for dynamic imports regarding type checking here
		}

		// TODO report this upstream?
		// Process named exports with source (re-exports)
		for (const node of parsed.program.body) {
			if (
				node.type === 'ExportNamedDeclaration' &&
				node.source // Check if it's a re-export
			) {
				// Skip type-only exports if ignore_types is true
				if (ignore_types && node.exportKind === 'type') {
					continue;
				}
				const value = node.source.value;
				if (value) {
					specifiers.push(value);
				}
			}
		}
	};

	if (is_svelte) {
		const matches = contents.matchAll(script_matcher);
		for (const m of matches) {
			parse_from(m[1]);
		}
	} else if (TS_MATCHER.test(id) || JS_MATCHER.test(id)) {
		parse_from(contents);
	}

	return specifiers;
};
