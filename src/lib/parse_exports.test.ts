import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
	infer_declarations_from_file_type,
	process_ts_exports,
	type Declaration_Kind,
} from './parse_exports.ts';

const {create_ts_test_env} = await import(resolve('src/fixtures/test_helpers.ts'));

const dir = dirname(fileURLToPath(import.meta.url));

test('infer_declarations_from_file_type detects Svelte components', () => {
	const declarations = infer_declarations_from_file_type('Component.svelte');
	assert.equal(declarations, [{name: 'default', kind: 'component'}]);
});

test('infer_declarations_from_file_type detects CSS files', () => {
	const declarations = infer_declarations_from_file_type('styles.css');
	assert.equal(declarations, [{name: 'default', kind: 'css'}]);
});

test('infer_declarations_from_file_type detects JSON files', () => {
	const declarations = infer_declarations_from_file_type('data.json');
	assert.equal(declarations, [{name: 'default', kind: 'json'}]);
});

test('infer_declarations_from_file_type does not infer for TypeScript files', () => {
	const declarations = infer_declarations_from_file_type('module.ts');
	assert.equal(declarations, []);
});

test('infer_declarations_from_file_type handles paths with directories', () => {
	const declarations = infer_declarations_from_file_type('src/components/Header.svelte');
	assert.equal(declarations, [{name: 'default', kind: 'component'}]);
});

test('infer_declarations_from_file_type handles extensions case-insensitively', () => {
	const declarations = infer_declarations_from_file_type('Component.SVELTE');
	assert.equal(declarations, [{name: 'default', kind: 'component'}]);
});

test('infer_declarations_from_file_type accumulates declarations', () => {
	const existing = [{name: 'existing', kind: 'variable' as Declaration_Kind}];
	const declarations = infer_declarations_from_file_type('Component.svelte', existing);
	assert.equal(declarations, [
		{name: 'existing', kind: 'variable'},
		{name: 'default', kind: 'component'},
	]);
});

test('process_ts_exports correctly identifies direct exports', () => {
	const source_code = `
		export const variable_export = 'test';
		export function function_export() { return true; }
		export class Class_Export {}
		export type Type_Export = string;
		export interface Interface_Export {}
	`;

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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
			Original_Type as Renamed_Type
		};
	`;

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
		Simple_Class: 'class',
		class_expression: 'class',
	});
});

test('process_ts_exports correctly identifies default exports', () => {
	const source_code = `
		function test_function() { return true; }
		export default test_function;
	`;

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
		default: 'function',
	});
});

test('process_ts_exports correctly identifies inline default exports', () => {
	const source_code = `
		export default function() { return true; }
	`;

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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

	const {source_file, checker, exports: export_symbols} = create_ts_test_env(source_code, dir);

	const declarations = process_ts_exports(source_file, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
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
		checker,
		exports: export_symbols,
	} = create_ts_test_env(module_b, dir, {
		'./module_a.ts': module_a,
	});

	const declarations = process_ts_exports(module_b_source, checker, export_symbols);

	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));
	assert.equal(declaration_map, {
		example_function: 'function',
		renamed_function: 'function',
	});
});

test.run();
