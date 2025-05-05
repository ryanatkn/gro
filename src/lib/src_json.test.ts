import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {to_src_modules} from './src_json.ts';
import {paths} from './paths.ts';

test('to_src_modules identifies all export kinds correctly', () => {
	const exports = {
		'./fixtures/modules/src_json_sample_exports.js': {
			import: './dist/src_json_sample_exports.js',
			types: './dist/src_json_sample_exports.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);

	// Ensure the module was processed
	assert.ok(result, 'result should be defined');
	assert.ok(result['./fixtures/modules/src_json_sample_exports.js'], 'module should be processed');

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const declarations = result['./fixtures/modules/src_json_sample_exports.js'].declarations || [];

	// Create a map of names to kinds for easier assertion
	const declaration_map = Object.fromEntries(declarations.map((d) => [d.name, d.kind]));

	// Expected declarations with their kinds
	const expected_declarations = {
		// Direct exports
		direct_variable: 'variable',
		direct_arrow_function: 'function',
		direct_function: 'function',
		Direct_Type: 'type',
		Direct_Interface: 'type',
		Direct_Class: 'class',

		// Named exports
		simple_variable: 'variable',
		arrow_function: 'function',
		multi_line_arrow: 'function',
		declared_function: 'function',
		Simple_Class: 'class',
		class_expression: 'class',
		object_value: 'variable',
		numeric_value: 'variable',

		// Renamed exports
		renamed_variable: 'variable',
		renamed_function: 'function',
		Renamed_Class: 'class',
		Renamed_Type: 'type',

		// Type exports
		Simple_Type: 'type',
		Simple_Interface: 'type',
		Variable_Type: 'type',
		Explicit_Type: 'type',

		// Default export
		default: 'function',

		// Special exports - using extra variable to avoid duplicate
		extra_variable: 'variable',

		// Dual purpose exports
		dual_purpose: 'variable',
		dual_purpose_type: 'type',
	};

	// Compare the entire result in one declarative assertion
	assert.equal(
		declaration_map,
		expected_declarations,
		'exports should be correctly identified with proper kinds',
	);
});

test('to_src_modules handles empty or undefined exports gracefully', () => {
	// Undefined exports
	assert.equal(
		to_src_modules(undefined, paths.source),
		undefined,
		'undefined exports should return undefined',
	);

	// Empty exports
	assert.equal(to_src_modules({}, paths.source), {}, 'empty exports should return empty object');
});

test.run();
