import {describe, test, expect} from 'vitest';

import {source_modules_create} from '../lib/source_json.ts';
import {paths} from '../lib/paths.ts';

describe('source_modules_create', () => {
	test('handles simple cases and omits `declarations` when empty', () => {
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

		const result = source_modules_create(exports, paths.source);

		expect(result).toBeDefined();
		expect(result).toHaveLength(2);

		// Find each module by path
		const script_module = result!.find(
			(m) => m.path === 'test/fixtures/modules/some_test_script.ts',
		);
		const ts_module = result!.find((m) => m.path === 'test/fixtures/modules/some_test_ts.ts');

		expect(script_module).toBeDefined();
		expect(ts_module).toBeDefined();

		// Script module should not have declarations (empty exports)
		expect(script_module!.declarations).toBeUndefined();

		// TS module should have declarations
		expect(ts_module!.declarations).toEqual([
			{name: 'a', kind: 'variable'},
			{name: 'some_test_ts', kind: 'variable'},
			{name: 'some_test_fn', kind: 'function'},
			{name: 'SomeTestType', kind: 'type'},
			{name: 'SomeTestInterface', kind: 'type'},
			{name: 'SomeTestClass', kind: 'class'},
		]);
	});

	test('identifies all export kinds correctly', () => {
		const exports = {
			'./test/fixtures/modules/src_json_sample_exports.js': {
				import: './dist/src_json_sample_exports.js',
				types: './dist/src_json_sample_exports.d.ts',
			},
		};

		const result = source_modules_create(exports, paths.source);

		expect(result).toBeDefined();
		expect(result).toHaveLength(1);
		expect(result![0]!.path).toBe('test/fixtures/modules/src_json_sample_exports.ts');

		expect(result![0]!.declarations).toEqual([
			{name: 'direct_function', kind: 'function'},
			{name: 'direct_variable', kind: 'variable'},
			{name: 'direct_arrow_function', kind: 'function'},
			{name: 'DirectType', kind: 'type'},
			{name: 'DirectInterface', kind: 'type'},
			{name: 'DirectClass', kind: 'class'},
			{name: 'simple_variable', kind: 'variable'},
			{name: 'arrow_function', kind: 'function'},
			{name: 'multi_line_arrow', kind: 'function'},
			{name: 'declared_function', kind: 'function'},
			{name: 'SimpleClass', kind: 'class'},
			{name: 'class_expression', kind: 'class'},
			{name: 'object_value', kind: 'variable'},
			{name: 'numeric_value', kind: 'variable'},
			{name: 'renamed_variable', kind: 'variable'},
			{name: 'renamed_function', kind: 'function'},
			{name: 'RenamedClass', kind: 'class'},
			{name: 'RenamedType', kind: 'type'},
			{name: 'SimpleType', kind: 'type'},
			{name: 'SimpleInterface', kind: 'type'},
			{name: 'VariableType', kind: 'type'},
			{name: 'extra_variable', kind: 'variable'},
			{name: 'ExplicitType', kind: 'type'},
			{name: 'default', kind: 'function'},
			{name: 'dual_purpose', kind: 'variable'},
			{name: 'dual_purpose_type', kind: 'type'},
		]);
	});

	test('handles empty or undefined exports gracefully', () => {
		// Undefined exports
		expect(source_modules_create(undefined)).toBeUndefined();

		// Empty exports
		expect(source_modules_create({})).toEqual([]);
	});
});
