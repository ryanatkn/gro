import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {resolve_exported_value, resolve_node_specifier} from './resolve_node_specifier.js';

test('resolves a Node specifier', () => {
	const specifier = 'svelte';
	const path_id = resolve('node_modules/svelte/src/index-server.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test('resolves a Node specifier with a username', () => {
	const specifier = '@sveltejs/kit';
	const path_id = resolve('node_modules/@sveltejs/kit/src/exports/index.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test('resolves a JS specifier', () => {
	const specifier = '@ryanatkn/fuz/tome.js';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/tome.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test('resolves a raw JS specifier', () => {
	const path = '@ryanatkn/fuz/tome.js';
	const specifier = path + '?raw';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/tome.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id + '?raw',
		raw: true,
		specifier,
		mapped_specifier: path,
		namespace: undefined,
	});
});

test('resolves a Svelte specifier', () => {
	const specifier = '@ryanatkn/fuz/Library.svelte';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/Library.svelte');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test('resolves a raw Svelte specifier', () => {
	const path = '@ryanatkn/fuz/Library.svelte';
	const specifier = path + '?raw';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/Library.svelte');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id + '?raw',
		raw: true,
		specifier,
		mapped_specifier: path,
		namespace: undefined,
	});
});

test('throws for an export that does not exist', () => {
	assert.throws(() => resolve_node_specifier('@ryanatkn/fuz/this_export_does_not_exist'));
});

test('throws for a package that does not exist', () => {
	assert.throws(() => resolve_node_specifier('@ryanatkn/this_package_does_not_exist'));
});

test('throws for a Node specifier', () => {
	assert.throws(() => resolve_node_specifier('node:path'));
});

test('optionally returns null for an export that does not exist', () => {
	assert.is(
		resolve_node_specifier(
			'@ryanatkn/fuz/this_export_does_not_exist',
			undefined,
			undefined,
			undefined,
			false,
		),
		null,
	);
});

test('optionally returns null for a package that does not exist', () => {
	assert.is(
		resolve_node_specifier(
			'@ryanatkn/this_package_does_not_exist',
			undefined,
			undefined,
			undefined,
			false,
		),
		null,
	);
});

test('optionally returns null for a Node specifier', () => {
	assert.is(resolve_node_specifier('node:path', undefined, undefined, undefined, false), null);
});

test('resolves nested condition exports', () => {
	const exported = {
		node: {
			import: './feature-node.js',
			require: './feature-node.cjs',
		},
		default: './feature.js',
	};

	// This should now correctly resolve to './feature-node.js'
	assert.equal(
		resolve_exported_value(exported, 'default', ['node', 'import']),
		'./feature-node.js',
	);
});

test('handles non-string values correctly', () => {
	const exported = {
		development: true,
		production: null,
		node: './node.js',
		default: './default.js',
	};

	// Should skip the boolean and null values and resolve to './node.js'
	assert.equal(
		resolve_exported_value(exported, 'default', ['development', 'production', 'node']),
		'./node.js',
	);
});

test('falls back to default in nested conditions', () => {
	const exported = {
		node: {
			import: './feature-node.js',
			require: './feature-node.cjs',
		},
		default: './feature.js',
	};

	assert.equal(resolve_exported_value(exported, 'default', ['browser']), './feature.js');
});

test('resolves deeply nested conditions', () => {
	const exported = {
		node: {
			development: {
				import: './dev-node.js',
				require: './dev-node.cjs',
			},
			production: {
				import: './prod-node.js',
				require: './prod-node.cjs',
			},
		},
		default: './feature.js',
	};

	assert.equal(
		resolve_exported_value(exported, 'default', ['node', 'development', 'import']),
		'./dev-node.js',
	);
});

test('handles null exports', () => {
	const exported = {
		node: null,
		default: './feature.js',
	};

	assert.equal(resolve_exported_value(exported, 'default', ['node']), './feature.js');
});

test('handles multiple valid conditions by priority', () => {
	const exported = {
		node: './node.js',
		development: './dev.js',
		default: './default.js',
	};

	assert.equal(resolve_exported_value(exported, 'default', ['development', 'node']), './dev.js');
});

test('respects condition order in nested structures', () => {
	const exported = {
		development: {
			node: './dev-node.js',
			browser: './dev-browser.js',
		},
		node: {
			development: './node-dev.js',
			production: './node-prod.js',
		},
	};

	assert.equal(
		resolve_exported_value(exported, 'default', ['development', 'node']),
		'./dev-node.js',
	);
});

test('falls back through multiple potential keys', () => {
	const exported = {
		// node: undefined,
		import: './import.js',
		require: './require.js',
		default: './default.js',
	};

	assert.equal(resolve_exported_value(exported, 'default', ['node']), './default.js');
});

test('handles non-string non-null values appropriately', () => {
	const exported = {
		development: true,
		default: './default.js',
	};

	assert.equal(resolve_exported_value(exported, 'default', ['development']), './default.js');
});

test('resolves nested exports with node and import conditions', () => {
	const exported = {
		node: {
			import: './feature-node.js',
			require: './feature-node.cjs',
		},
		default: './feature.js',
	};

	assert.equal(
		resolve_exported_value(exported, 'default', ['node', 'import']),
		'./feature-node.js',
	);

	// Test fallback
	assert.equal(resolve_exported_value(exported, 'default', ['browser']), './feature.js');
});

test('follows condition priority strictly', () => {
	const exported = {
		development: './dev.js',
		node: './node.js',
		default: './default.js',
	};

	assert.equal(resolve_exported_value(exported, 'default', ['development', 'node']), './dev.js');

	assert.equal(resolve_exported_value(exported, 'default', ['node', 'development']), './node.js');
});

test('properly resolves module-sync condition', () => {
	const exported = {
		'module-sync': './sync.js',
		import: './async.js',
		default: './fallback.js',
	};

	assert.equal(resolve_exported_value(exported, 'default', ['module-sync']), './sync.js');
});

test.run();
