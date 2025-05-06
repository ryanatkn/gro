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

	assert.equal(result, {
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
