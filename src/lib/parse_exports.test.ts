import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
	infer_declarations_from_file_type,
	process_ts_exports,
	type Export_Declaration,
} from './parse_exports.ts';
import {create_ts_test_env} from './test_helpers.ts';

const dir = dirname(fileURLToPath(import.meta.url));

const create_declaration_map = (declarations: Array<Export_Declaration>) =>
	Object.fromEntries(declarations.map((d) => [d.name, d.kind]));

test('infer_declarations_from_file_type detects Svelte components', () => {
	assert.equal(infer_declarations_from_file_type('Component.svelte'), [
		{name: 'default', kind: 'component'},
	]);
});

test('infer_declarations_from_file_type detects CSS files', () => {
	assert.equal(infer_declarations_from_file_type('styles.css'), [{name: 'default', kind: 'css'}]);
});

test('infer_declarations_from_file_type detects JSON files', () => {
	assert.equal(infer_declarations_from_file_type('data.json'), [{name: 'default', kind: 'json'}]);
});

test('infer_declarations_from_file_type does not infer for TypeScript files', () => {
	assert.equal(infer_declarations_from_file_type('module.ts'), []);
});

test('infer_declarations_from_file_type handles paths with directories', () => {
	assert.equal(infer_declarations_from_file_type('src/components/Header.svelte'), [
		{name: 'default', kind: 'component'},
	]);
});

test('infer_declarations_from_file_type handles extensions case-insensitively', () => {
	assert.equal(infer_declarations_from_file_type('Component.SVELTE'), [
		{name: 'default', kind: 'component'},
	]);
});

test('infer_declarations_from_file_type accumulates declarations', () => {
	assert.equal(
		infer_declarations_from_file_type('Component.svelte', [{name: 'existing', kind: 'variable'}]),
		[
			{name: 'existing', kind: 'variable'},
			{name: 'default', kind: 'component'},
		],
	);
});

test('process_ts_exports correctly identifies direct exports', () => {
	const source_code = `
		export const variable_export = 'test';
		export function function_export() { return true; }
		export class Class_Export {}
		export type Type_Export = string;
		export interface Interface_Export {}
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		variable_export: 'variable',
		function_export: 'function',
		Class_Export: 'class',
		Type_Export: 'type',
		Interface_Export: 'type',
	});
});

test('process_ts_exports correctly identifies named exports', () => {
	const source_code = `
		const variable_value = 'test';
		function function_value() { return true; }
		class Class_Value {}
		type Type_Value = string;
		interface Interface_Value {}
		
		export { 
			variable_value, 
			function_value, 
			Class_Value,
			Type_Value,
			Interface_Value
		};
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		variable_value: 'variable',
		function_value: 'function',
		Class_Value: 'class',
		Type_Value: 'type',
		Interface_Value: 'type',
	});
});

test('process_ts_exports correctly identifies renamed exports', () => {
	const source_code = `
		const original_variable = 'test';
		function original_function() { return true; }
		class Original_Class {}
		type Original_Type = string;
		
		export { 
			original_variable as renamed_variable, 
			original_function as renamed_function,
			Original_Class as Renamed_Class,
			type Original_Type as Renamed_Type
		};
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		renamed_variable: 'variable',
		renamed_function: 'function',
		Renamed_Class: 'class',
		Renamed_Type: 'type',
	});
});

test('process_ts_exports correctly identifies type-only exports', () => {
	const source_code = `
		type Regular_Type = string;
		export type Direct_Type = number;
		
		interface Regular_Interface { foo: string; }
		export interface Direct_Interface { bar: number; }
		
		export type { Regular_Type, Regular_Interface };
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		Direct_Type: 'type',
		Direct_Interface: 'type',
		Regular_Type: 'type',
		Regular_Interface: 'type',
	});
});

test('process_ts_exports correctly identifies function exports', () => {
	const source_code = `
		const arrow_function = () => 'arrow';
		const multi_line_arrow = () => {
			return 'multi-line arrow';
		};
		function declared_function() { return 'declared'; }
		
		export { arrow_function, multi_line_arrow, declared_function };
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		arrow_function: 'function',
		multi_line_arrow: 'function',
		declared_function: 'function',
	});
});

test('process_ts_exports correctly identifies class exports', () => {
	const source_code = `
		class Simple_Class {}
		
		const class_expression = class Named_Class { 
			method() {}
		};
		
		export { Simple_Class, class_expression };
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		Simple_Class: 'class',
		class_expression: 'class',
	});
});

test('process_ts_exports correctly identifies default exports', () => {
	const source_code = `
		function test_function() { return true; }
		export default test_function;
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		default: 'function',
	});
});

test('process_ts_exports correctly identifies inline default exports', () => {
	const source_code = `
		export default function() { return true; }
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		default: 'function',
	});
});

test('process_ts_exports correctly identifies dual purpose exports', () => {
	const source_code = `
		// Symbol is both a value and a type
		const dual_purpose = 'I am both value and type';
		type dual_purpose = string;
		
		// Export as a value
		export { dual_purpose };
		
		// Also export as a type
		export type { dual_purpose as dual_purpose_type };
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		dual_purpose: 'variable', // Should be identified as variable when exported as value
		dual_purpose_type: 'type', // And as type when exported as type
	});
});

test('process_ts_exports correctly handles type-based exports of dual purpose symbols', () => {
	const source_code = `
		// Symbol is both a value and a type
		const dual_purpose = 'I am both value and type';
		type dual_purpose = string;
		
		// Only export as a type, not as a value
		export type { dual_purpose };
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		dual_purpose: 'type', // Should be identified as type when only exported as type
	});
});

test('process_ts_exports correctly handles aliased dual purpose exports', () => {
	const source_code = `
		// Symbol is both a value and a type
		const dual_purpose = 'I am both value and type';
		type dual_purpose = string;
		
		// Export as a value with an alias
		export { dual_purpose as dual_purpose_alias };
		
		// Also export as a type with a different alias
		export type { dual_purpose as dual_purpose_type_alias };
	`;

	const {source_file, program, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		dual_purpose_alias: 'variable', // Should be identified as variable when exported as value
		dual_purpose_type_alias: 'type', // Should be identified as type when exported as type
	});
});

test('process_ts_exports correctly identifies re-exported functions', () => {
	const module_a = `
		export function example_function() { return true; }
	`;

	const module_b = `
		export {example_function} from './module_a.ts';
		export {example_function as renamed_function} from './module_a.ts';
	`;

	const {
		source_file: module_b_source,
		program,
		exports: export_symbols,
	} = create_ts_test_env(module_b, dir, {
		'./module_a.ts': module_a,
	});

	const declarations = process_ts_exports(module_b_source, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		example_function: 'function',
		renamed_function: 'function',
	});
});

test('process_ts_exports correctly identifies re-exported functions with type exports', () => {
	const plugin_module = `
		export interface Plugin {
			name: string;
		}

		export const replace_plugin = (
			plugins,
			new_plugin,
			name = new_plugin.name,
		) => {
			return [new_plugin];
		};
	`;

	const index_module = `
		export {type Plugin, replace_plugin} from './plugin_module.ts';
	`;

	const {
		source_file: index_source,
		program,
		exports: export_symbols,
	} = create_ts_test_env(index_module, dir, {
		'./plugin_module.ts': plugin_module,
	});

	const declarations = process_ts_exports(index_source, program, export_symbols);

	assert.equal(create_declaration_map(declarations), {
		Plugin: 'type',
		replace_plugin: 'function',
	});
});

// Add a test for the actual `replace_plugin` from plugin.ts
test('process_ts_exports correctly identifies replace_plugin from actual plugin.ts', () => {
	// Create a simplified version of the index.ts content
	const index_code = `
		export {type Plugin, replace_plugin} from './plugin.ts';
	`;

	// Create the test environment with the actual plugin.ts file
	const {source_file, program, exports: export_symbols} = create_ts_test_env(index_code, dir);

	const declarations = process_ts_exports(source_file, program, export_symbols);

	// Find the replace_plugin export
	const replace_plugin_declaration = declarations.find((d) => d.name === 'replace_plugin');
	assert.ok(replace_plugin_declaration, 'replace_plugin export should be found');
	assert.equal(
		replace_plugin_declaration.kind,
		'function',
		'replace_plugin should be identified as a function',
	);
});

test.run();
