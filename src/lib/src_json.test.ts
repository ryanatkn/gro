import {describe, test, expect} from 'vitest';

import {to_src_modules} from './src_json.ts';
import {paths} from './paths.ts';

describe('to_src_modules', () => {
	test('handles simple cases and omits `declarations` when empty', () => {
		const exports = {
			'./fixtures/modules/some_test_script.js': {
				import: './dist/some_test_script.js',
				types: './dist/some_test_script.d.ts',
			},
			'./fixtures/modules/some_test_ts.js': {
				import: './dist/some_test_ts.js',
				types: './dist/some_test_ts.d.ts',
			},
		};

		const result = to_src_modules(exports, paths.source);

		expect(result).toBeDefined();
		expect(result!['./fixtures/modules/some_test_script.js']).toBeDefined();

		expect(result).toEqual({
			'./fixtures/modules/some_test_script.js': {
				path: 'fixtures/modules/some_test_script.ts',
				// `declarations` should be omitted when empty
			},
			'./fixtures/modules/some_test_ts.js': {
				path: 'fixtures/modules/some_test_ts.ts',
				declarations: [
					{name: 'a', kind: 'variable'},
					{name: 'some_test_ts', kind: 'variable'},
					{name: 'some_test_fn', kind: 'function'},
					{name: 'Some_Test_Type', kind: 'type'},
					{name: 'Some_Test_Interface', kind: 'type'},
					{name: 'Some_Test_Class', kind: 'class'},
				],
			},
		});
	});

	test('identifies all export kinds correctly', () => {
		const exports = {
			'./fixtures/modules/src_json_sample_exports.js': {
				import: './dist/src_json_sample_exports.js',
				types: './dist/src_json_sample_exports.d.ts',
			},
		};

		const result = to_src_modules(exports, paths.source);

		expect(result).toBeDefined();
		expect(result!['./fixtures/modules/src_json_sample_exports.js']).toBeDefined();

		expect(result).toEqual({
			'./fixtures/modules/src_json_sample_exports.js': {
				path: 'fixtures/modules/src_json_sample_exports.ts',
				declarations: [
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
				],
			},
		});
	});

	test('handles empty or undefined exports gracefully', () => {
		// Undefined exports
		expect(to_src_modules(undefined, paths.source)).toBeUndefined();

		// Empty exports
		expect(to_src_modules({}, paths.source)).toEqual({});
	});
});
