import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {to_src_modules} from './src_json.ts';
import {paths} from './paths.ts';

// Basic functionality test
test('to src modules basic parsing', () => {
	const exports = {
		'./fixtures/modules/export_specifiers.js': {
			import: './dist/export_specifiers.js',
			types: './dist/export_specifiers.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);

	assert.ok(result, 'to_src_modules should return a result');
	assert.ok(
		result['./fixtures/modules/export_specifiers.js'],
		'result should contain the module path',
	);
	assert.ok(
		Array.isArray(result['./fixtures/modules/export_specifiers.js'].declarations),
		'module should have declarations array',
	);
	assert.ok(
		result['./fixtures/modules/export_specifiers.js'].declarations.length > 0,
		'declarations array should not be empty',
	);
});

// Tests for different export kinds
test('identifies basic exports correctly', () => {
	// Create a fixture with basic exports for testing
	const exports = {
		'./fixtures/modules/export_specifiers.js': {
			import: './dist/export_specifiers.js',
			types: './dist/export_specifiers.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/export_specifiers.js'].declarations || [];

	// Check variable export
	assert.equal(
		declarations.find((d) => d.name === 'exported_variable')?.kind,
		'variable',
		'exported_variable should be identified as variable',
	);

	// Check function export
	assert.equal(
		declarations.find((d) => d.name === 'exported_fn')?.kind,
		'function',
		'exported_fn should be identified as function',
	);

	// Check type export
	assert.equal(
		declarations.find((d) => d.name === 'exported_type')?.kind,
		'type',
		'exported_type should be identified as type',
	);

	// Check class export
	assert.equal(
		declarations.find((d) => d.name === 'exported_class')?.kind,
		'class',
		'exported_class should be identified as class',
	);

	// Check default export
	assert.equal(
		declarations.find((d) => d.name === 'default')?.kind,
		'variable',
		'default export should be identified as variable',
	);
});

// Class export tests
test('identifies class exports correctly', () => {
	// This test would need a fixture file with class exports
	// Since we don't have that file, we can mock the exports object and assertions

	// Using the existing exports module for the moment
	const exports = {
		'./fixtures/modules/comprehensive_exports.js': {
			import: './dist/comprehensive_exports.js',
			types: './dist/comprehensive_exports.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/comprehensive_exports.js'].declarations || [];

	// Check class declaration
	assert.equal(
		declarations.find((d) => d.name === 'DirectClass')?.kind,
		'class',
		'DirectClass should be identified as class',
	);

	// Check Class_Expression (This is failing based on your error message)
	assert.equal(
		declarations.find((d) => d.name === 'Class1')?.kind,
		'class',
		'Class1 should be identified as class',
	);
});

// Function export tests
test('identifies function exports correctly', () => {
	// Test with arrow functions fixture
	const exports = {
		'./fixtures/modules/arrow_functions.js': {
			import: './dist/arrow_functions.js',
			types: './dist/arrow_functions.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/arrow_functions.js'].declarations || [];

	// Check arrow functions
	assert.equal(
		declarations.find((d) => d.name === 'arrow_fn1')?.kind,
		'function',
		'arrow_fn1 should be identified as function',
	);

	assert.equal(
		declarations.find((d) => d.name === 'arrow_fn2')?.kind,
		'function',
		'arrow_fn2 should be identified as function',
	);

	// Check regular function declaration
	assert.equal(
		declarations.find((d) => d.name === 'declared_fn')?.kind,
		'function',
		'declared_fn should be identified as function',
	);

	// Check variable that's not a function
	assert.equal(
		declarations.find((d) => d.name === 'regular_variable')?.kind,
		'variable',
		'regular_variable should be identified as variable',
	);
});

// Type exports test
test('handles type exports and aliasing', () => {
	const exports = {
		'./fixtures/modules/type_exports.js': {
			import: './dist/type_exports.js',
			types: './dist/type_exports.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/type_exports.js'].declarations || [];

	// Test variable exported as type
	assert.equal(
		declarations.find((d) => d.name === 'Variable_Type')?.kind,
		'type',
		'Variable_Type should be identified as type when exported with type alias',
	);

	// Verify all declarations with clear messages
	assert.equal(
		declarations.find((d) => d.name === 'Variable_Example')?.kind,
		'variable',
		'Variable_Example should be identified as variable',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Another_Variable')?.kind,
		'variable',
		'Another_Variable should be identified as variable',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Type_Example')?.kind,
		'type',
		'Type_Example should be identified as type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Interface_Example')?.kind,
		'type',
		'Interface_Example should be identified as type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Named_Type_Export')?.kind,
		'type',
		'Named_Type_Export should be identified as type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Named_Variable_Export')?.kind,
		'variable',
		'Named_Variable_Export should be identified as variable',
	);
});

// Handle export specifiers test
test('handles export specifiers', () => {
	const exports = {
		'./fixtures/modules/export_specifiers.js': {
			import: './dist/export_specifiers.js',
			types: './dist/export_specifiers.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/export_specifiers.js'].declarations || [];

	// Check that all export specifiers are correctly identified
	assert.equal(
		declarations.find((d) => d.name === 'exported_variable')?.kind,
		'variable',
		'exported_variable should be identified as variable',
	);

	assert.equal(
		declarations.find((d) => d.name === 'exported_fn')?.kind,
		'function',
		'exported_fn should be identified as function',
	);

	assert.equal(
		declarations.find((d) => d.name === 'exported_type')?.kind,
		'type',
		'exported_type should be identified as type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'exported_class')?.kind,
		'class',
		'exported_class should be identified as class',
	);
});

// Arrow function exports test
test('handles arrow function exports', () => {
	const exports = {
		'./fixtures/modules/arrow_functions.js': {
			import: './dist/arrow_functions.js',
			types: './dist/arrow_functions.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/arrow_functions.js'].declarations || [];

	// Check that arrow functions are identified as functions
	assert.equal(
		declarations.find((d) => d.name === 'arrow_fn1')?.kind,
		'function',
		'arrow_fn1 should be identified as function',
	);

	assert.equal(
		declarations.find((d) => d.name === 'arrow_fn2')?.kind,
		'function',
		'arrow_fn2 should be identified as function',
	);

	// Check that regular variables are not identified as functions
	assert.equal(
		declarations.find((d) => d.name === 'regular_variable')?.kind,
		'variable',
		'regular_variable should be identified as variable',
	);
});

// Comprehensive export scenarios test
test('handles comprehensive export scenarios', () => {
	const exports = {
		'./fixtures/modules/comprehensive_exports.js': {
			import: './dist/comprehensive_exports.js',
			types: './dist/comprehensive_exports.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/comprehensive_exports.js'].declarations || [];

	// Test direct exports
	assert.equal(
		declarations.find((d) => d.name === 'direct_variable')?.kind,
		'variable',
		'direct_variable should be identified as variable',
	);

	assert.equal(
		declarations.find((d) => d.name === 'direct_function')?.kind,
		'function',
		'direct_function should be identified as function',
	);

	assert.equal(
		declarations.find((d) => d.name === 'direct_named_function')?.kind,
		'function',
		'direct_named_function should be identified as function',
	);

	assert.equal(
		declarations.find((d) => d.name === 'DirectType')?.kind,
		'type',
		'DirectType should be identified as type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'DirectInterface')?.kind,
		'type',
		'DirectInterface should be identified as type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'DirectClass')?.kind,
		'class',
		'DirectClass should be identified as class',
	);

	// Test renamed exports
	assert.equal(
		declarations.find((d) => d.name === 'renamed_variable')?.kind,
		'variable',
		'renamed_variable should be identified as variable',
	);

	assert.equal(
		declarations.find((d) => d.name === 'renamed_type')?.kind,
		'type',
		'renamed_type should be identified as type',
	);

	// Test default export (This is failing based on your error message)
	assert.equal(
		declarations.find((d) => d.name === 'default')?.kind,
		'function',
		'default export should be identified as function',
	);

	// Test exports of values declared elsewhere
	assert.equal(
		declarations.find((d) => d.name === 'variable1')?.kind,
		'variable',
		'variable1 should be identified as variable',
	);

	assert.equal(
		declarations.find((d) => d.name === 'fn2')?.kind,
		'function',
		'fn2 should be identified as function',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Type1')?.kind,
		'type',
		'Type1 should be identified as type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Interface1')?.kind,
		'type',
		'Interface1 should be identified as type',
	);
});

// Test for export precedence
test('handles export precedence', () => {
	const exports = {
		'./fixtures/modules/export_precedence.js': {
			import: './dist/export_precedence.js',
			types: './dist/export_precedence.d.ts',
		},
	};

	const result = to_src_modules(exports, paths.source);
	const declarations = result?.['./fixtures/modules/export_precedence.js'].declarations || [];

	// Test variable exported as type
	assert.equal(
		declarations.find((d) => d.name === 'Dual_Export')?.kind,
		'variable',
		'Dual_Export should be identified as variable when exported as a value',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Function_And_Type')?.kind,
		'type',
		'Function_And_Type should be identified as type when only exported as a type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Another_Dual_Export')?.kind,
		'type',
		'Another_Dual_Export should be identified as type when only exported as a type',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Value_Only')?.kind,
		'variable',
		'Value_Only should be identified as variable when only exported as a value',
	);

	assert.equal(
		declarations.find((d) => d.name === 'Type_Only')?.kind,
		'type',
		'Type_Only should be identified as type when only exported as a type',
	);
});

test.run();
