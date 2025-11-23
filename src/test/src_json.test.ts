import {describe, test, expect} from 'vitest';

import {src_modules_create} from '../lib/src_json.ts';
import {paths} from '../lib/paths.ts';

describe('src_modules_create', () => {
	test('handles simple cases and omits `identifiers` when empty', () => {
		const exports = {
			'./test/fixtures/modules/some_test_script.js': {
				import: './dist/some_test_script.js',
				types: './dist/some_test_script.d.ts',
			},
			'./test/fixtures/modules/some_test_ts.js': {
				import: './dist/some_test_ts.js',
				types: './dist/some_test_ts.d.ts',
			},
		};

		const result = src_modules_create(exports, paths.source);

		expect(result).toBeDefined();
		expect(result).toHaveLength(2);

		// Find each module by path
		const script_module = result!.find(
			(m) => m.path === 'test/fixtures/modules/some_test_script.ts',
		);
		const ts_module = result!.find((m) => m.path === 'test/fixtures/modules/some_test_ts.ts');

		expect(script_module).toBeDefined();
		expect(ts_module).toBeDefined();

		// Script module should not have identifiers (empty exports)
		expect(script_module!.identifiers).toBeUndefined();

		// TS module should have identifiers
		expect(ts_module!.identifiers).toEqual([
			{name: 'a', kind: 'variable'},
			{name: 'some_test_ts', kind: 'variable'},
			{name: 'some_test_fn', kind: 'function'},
			{name: 'Some_Test_Type', kind: 'type'},
			{name: 'Some_Test_Interface', kind: 'type'},
			{name: 'Some_Test_Class', kind: 'class'},
		]);
	});

	test('identifies all export kinds correctly', () => {
		const exports = {
			'./test/fixtures/modules/src_json_sample_exports.js': {
				import: './dist/src_json_sample_exports.js',
				types: './dist/src_json_sample_exports.d.ts',
			},
		};

		const result = src_modules_create(exports, paths.source);

		expect(result).toBeDefined();
		expect(result).toHaveLength(1);
		expect(result![0]!.path).toBe('test/fixtures/modules/src_json_sample_exports.ts');

		expect(result![0]!.identifiers).toEqual([
			{name: 'direct_function', kind: 'function'},
			{name: 'direct_variable', kind: 'variable'},
			{name: 'direct_arrow_function', kind: 'function'},
			{name: 'Direct_Type', kind: 'type'},
			{name: 'Direct_Interface', kind: 'type'},
			{name: 'Direct_Class', kind: 'class'},
			{name: 'simple_variable', kind: 'variable'},
			{name: 'arrow_function', kind: 'function'},
			{name: 'multi_line_arrow', kind: 'function'},
			{name: 'declared_function', kind: 'function'},
			{name: 'Simple_Class', kind: 'class'},
			{name: 'class_expression', kind: 'class'},
			{name: 'object_value', kind: 'variable'},
			{name: 'numeric_value', kind: 'variable'},
			{name: 'renamed_variable', kind: 'variable'},
			{name: 'renamed_function', kind: 'function'},
			{name: 'Renamed_Class', kind: 'class'},
			{name: 'Renamed_Type', kind: 'type'},
			{name: 'Simple_Type', kind: 'type'},
			{name: 'Simple_Interface', kind: 'type'},
			{name: 'Variable_Type', kind: 'type'},
			{name: 'extra_variable', kind: 'variable'},
			{name: 'Explicit_Type', kind: 'type'},
			{name: 'default', kind: 'function'},
			{name: 'dual_purpose', kind: 'variable'},
			{name: 'dual_purpose_type', kind: 'type'},
		]);
	});

	test('handles empty or undefined exports gracefully', () => {
		// Undefined exports
		expect(src_modules_create(undefined)).toBeUndefined();

		// Empty exports
		expect(src_modules_create({})).toEqual([]);
	});
});
