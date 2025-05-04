import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {to_src_modules} from './src_json.ts';
import {to_package_exports} from './package_json.ts';
import {paths} from './paths.ts';

test('to_src_modules', () => {
	assert.equal(
		to_src_modules(
			to_package_exports([
				'fixtures/modules/some_test_css.css',
				'fixtures/modules/Some_Test_Svelte.svelte',
				'fixtures/modules/some_test_ts.ts',
				'fixtures/modules/some_test_json.json',
			]),
			paths.source,
		),
		{
			'./package.json': {path: 'package.json', declarations: []},
			'./fixtures/modules/some_test_css.css': {
				path: 'fixtures/modules/some_test_css.css',
				declarations: [],
			},
			'./fixtures/modules/some_test_json.json': {
				path: 'fixtures/modules/some_test_json.json',
				declarations: [],
			},
			'./fixtures/modules/Some_Test_Svelte.svelte': {
				path: 'fixtures/modules/Some_Test_Svelte.svelte',
				declarations: [],
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
		},
	);
});

test('handles_export_specifiers', () => {
	const exports = {
		'./fixtures/modules/export_specifiers.js': {
			import: './dist/export_specifiers.js',
			types: './dist/export_specifiers.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);

	assert.equal(result?.['./fixtures/modules/export_specifiers.js'].declarations, [
		{name: 'exported_variable', kind: 'variable'},
		{name: 'exported_fn', kind: 'function'},
		{name: 'exported_type', kind: 'type'},
		{name: 'exported_class', kind: 'class'},
		{name: 'default', kind: 'variable'},
	]);
});

test('handles_arrow_function_exports', () => {
	const exports = {
		'./fixtures/modules/arrow_functions.js': {
			import: './dist/arrow_functions.js',
			types: './dist/arrow_functions.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);

	assert.equal(result?.['./fixtures/modules/arrow_functions.js'].declarations, [
		{name: 'arrow_fn1', kind: 'function'},
		{name: 'arrow_fn2', kind: 'function'},
		{name: 'regular_variable', kind: 'variable'},
		{name: 'declared_fn', kind: 'function'},
	]);
});

test('handles_type_exports_and_aliasing', () => {
	const exports = {
		'./fixtures/modules/type_exports.js': {
			import: './dist/type_exports.js',
			types: './dist/type_exports.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);

	// Test the specific case of a variable exported as a type
	const variable_type_declaration = result?.[
		'./fixtures/modules/type_exports.js'
	].declarations.find((d) => d.name === 'Variable_Type');
	assert.equal(
		variable_type_declaration?.kind,
		'type',
		'Variable_Type should be identified as a type, not a variable',
	);

	// Verify all declarations
	assert.equal(result?.['./fixtures/modules/type_exports.js'].declarations, [
		{name: 'Variable_Example', kind: 'variable'},
		{name: 'Another_Variable', kind: 'variable'},
		{name: 'Type_Example', kind: 'type'},
		{name: 'Interface_Example', kind: 'type'},
		{name: 'Variable_Type', kind: 'type'},
		{name: 'Named_Type_Export', kind: 'type'},
		{name: 'Named_Variable_Export', kind: 'variable'},
	]);
});

test('handles_comprehensive_export_scenarios', () => {
	const exports = {
		'./fixtures/modules/comprehensive_exports.js': {
			import: './dist/comprehensive_exports.js',
			types: './dist/comprehensive_exports.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/comprehensive_exports.js'].declarations || [];

	// Direct variable exports
	assert.equal(
		declarations.find((d) => d.name === 'direct_variable')?.kind,
		'variable',
		'direct_variable should be identified as a variable',
	);

	// Function exports (both forms)
	assert.equal(
		declarations.find((d) => d.name === 'direct_function')?.kind,
		'function',
		'direct_function should be identified as a function',
	);
	assert.equal(
		declarations.find((d) => d.name === 'direct_named_function')?.kind,
		'function',
		'direct_named_function should be identified as a function',
	);

	// Type exports
	assert.equal(
		declarations.find((d) => d.name === 'DirectType')?.kind,
		'type',
		'DirectType should be identified as a type',
	);
	assert.equal(
		declarations.find((d) => d.name === 'DirectInterface')?.kind,
		'type',
		'DirectInterface should be identified as a type',
	);

	// Class exports
	assert.equal(
		declarations.find((d) => d.name === 'DirectClass')?.kind,
		'class',
		'DirectClass should be identified as a class',
	);

	// Default export
	assert.equal(
		declarations.find((d) => d.name === 'default')?.kind,
		'function',
		'default export should be identified as a function',
	);

	// Re-exported declarations
	assert.equal(
		declarations.find((d) => d.name === 'renamed_variable')?.kind,
		'variable',
		'renamed_variable should be identified as a variable',
	);
	assert.equal(
		declarations.find((d) => d.name === 'renamed_type')?.kind,
		'type',
		'renamed_type should be identified as a type',
	);
});

test('handles_export_precedence_with_type_and_value_exports', () => {
	const exports = {
		'./fixtures/modules/export_precedence.js': {
			import: './dist/export_precedence.js',
			types: './dist/export_precedence.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/export_precedence.js'].declarations || [];

	// This is exported as a value directly and should take precedence over type definition
	assert.equal(
		declarations.find((d) => d.name === 'Dual_Export')?.kind,
		'variable',
		'Dual_Export should be identified as a variable (exported as value)',
	);

	// This is exported only as a type
	assert.equal(
		declarations.find((d) => d.name === 'Another_Dual_Export')?.kind,
		'type',
		'Another_Dual_Export should be identified as a type (exported as type)',
	);

	// This is exported as both value and type - value should take precedence
	assert.equal(
		declarations.find((d) => d.name === 'Function_And_Type')?.kind,
		'type',
		'Function_And_Type should be identified as a function (value takes precedence)',
	);

	// Check that Value_Only is a variable
	assert.equal(
		declarations.find((d) => d.name === 'Value_Only')?.kind,
		'variable',
		'Value_Only should be identified as a variable',
	);

	// Check that Type_Only is a type
	assert.equal(
		declarations.find((d) => d.name === 'Type_Only')?.kind,
		'type',
		'Type_Only should be identified as a type',
	);
});

test.run();
