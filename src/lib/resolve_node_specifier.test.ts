import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
	resolve_exported_value,
	resolve_node_specifier,
	resolve_subpath,
} from './resolve_node_specifier.js';
import type {Package_Json} from './package_json.js';

const TEST_ROOT = fileURLToPath(new URL('.', import.meta.url));

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

test('handles basic pattern exports', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./features/*.js': './src/features/*.js',
		},
	};
	const resolved = resolve_subpath(mock_package, './features/test.js');
	assert.equal(resolved, './src/features/test.js');
});

test('handles multiple pattern exports in priority order', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./features/*.js': './src/features/*.js',
			'./features/*': './src/features/*',
			'./features/*/index.js': null,
		},
	};
	const resolved = resolve_subpath(mock_package, './features/test.js');
	assert.equal(resolved, './src/features/test.js');
});

test('handles null pattern exports as blockers', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./internal/*': null,
			'./*': './src/*',
		},
	};

	// Test blocked path
	const blocked = resolve_subpath(mock_package, './internal/secret.js');
	assert.equal(blocked, null);

	// Test allowed path
	const allowed = resolve_subpath(mock_package, './public/file.js');
	assert.equal(allowed, './src/public/file.js');
});

test('handles deeply nested conditional exports', () => {
	const exported = {
		node: {
			import: {
				development: './dev-esm.js',
				production: './prod-esm.js',
			},
			require: {
				development: './dev-cjs.js',
				production: './prod-cjs.js',
			},
		},
		default: './fallback.js',
	};

	assert.equal(resolve_exported_value(exported, ['node', 'import', 'development']), './dev-esm.js');

	assert.equal(
		resolve_exported_value(exported, ['node', 'require', 'production']),
		'./prod-cjs.js',
	);
});

test('respects condition order for mutually exclusive conditions', () => {
	const exported = {
		import: './esm.js',
		require: './cjs.js',
		default: './fallback.js',
	};

	// import and require are mutually exclusive
	assert.equal(resolve_exported_value(exported, ['import', 'require']), './esm.js');

	assert.equal(resolve_exported_value(exported, ['require', 'import']), './cjs.js');
});

test('respects node-addons condition priority', () => {
	const exported = {
		'node-addons': './native.node',
		node: './pure.js',
		default: './fallback.js',
	};

	assert.equal(resolve_exported_value(exported, ['node-addons', 'node']), './native.node');

	// When node-addons is not in conditions, should fall back
	assert.equal(resolve_exported_value(exported, ['node']), './pure.js');
});

test('handles complex pattern exports with multiple wildcards', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./features/*/components/*.js': './src/features/*/components/*.js',
			'./features/*/*': './src/features/*/*',
		},
	};
	const resolved = resolve_subpath(mock_package, './features/auth/components/login.js');
	assert.equal(resolved, './src/features/auth/components/login.js');
});

test('handles conditional pattern exports', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./lib/*.js': {
				node: './node/lib/*.js',
				default: './lib/*.js',
			},
		},
	};
	const subpath = resolve_subpath(mock_package, './lib/utils.js');
	const resolved = resolve_exported_value(subpath, ['node']);
	assert.equal(resolved, './node/lib/utils.js');
});

test('handles invalid exports values', () => {
	const exported = {
		development: true,
		production: 123,
		node: null,
		browser: undefined,
		default: './index.js',
	};

	assert.equal(
		resolve_exported_value(exported, ['development', 'production', 'node', 'browser']),
		'./index.js',
	);
});

test('handles empty conditions array', () => {
	const exported = {
		node: './node.js',
		default: './fallback.js',
	};

	assert.equal(resolve_exported_value(exported, []), './fallback.js');
});

test('handles missing default condition', () => {
	const exported = {
		node: './node.js',
		browser: './browser.js',
	};

	assert.equal(resolve_exported_value(exported, ['deno']), undefined);
});

test('handles exports sugar syntax', () => {
	const exported = './index.js';

	assert.equal(resolve_exported_value(exported, ['node']), './index.js');
});

test('handles condition object with only default', () => {
	const exported = {
		default: './index.js',
	};

	assert.equal(resolve_exported_value(exported, ['node']), './index.js');
});

test('handles multiple patterns in correct order', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'.': './index.js',
			'./lib/*': './src/lib/*',
			'./lib/*/index.js': './src/lib/*/index.js',
			'./lib/internal/*': null,
		},
	};
	const resolved = resolve_subpath(mock_package, '.');
	assert.equal(resolved, './index.js');
});

test('prioritizes exact matches over patterns', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./utils/index.js': './dist/utils/index.js',
			'./utils/*': './src/utils/*',
		},
	};
	const resolved = resolve_subpath(mock_package, './utils/index.js');
	assert.equal(resolved, './dist/utils/index.js');
});

test('handles nested conditions with patterns', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./components/*.js': {
				import: './esm/components/*.js',
				require: './cjs/components/*.js',
				default: './components/*.js',
			},
		},
	};
	const subpath = resolve_subpath(mock_package, './components/button.js');
	const resolved = resolve_exported_value(subpath, ['import']);
	assert.equal(resolved, './esm/components/button.js');
});

test('pattern matches with multiple path segments', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./assets/*': './public/assets/*',
		},
	};
	const resolved = resolve_subpath(mock_package, './assets/images/logo.png');
	assert.equal(resolved, './public/assets/images/logo.png');
});

test('null pattern blocks path with multiple segments', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./private/*': null,
			'./*': './src/*',
		},
	};
	const blocked = resolve_subpath(mock_package, './private/secret/data.json');
	assert.equal(blocked, null);

	const allowed = resolve_subpath(mock_package, './public/data.json');
	assert.equal(allowed, './src/public/data.json');
});

test('pattern matching with multiple wildcards', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./features/*/components/*.js': './src/features/*/components/*.js',
		},
	};
	const resolved = resolve_subpath(mock_package, './features/auth/components/login.js');
	assert.equal(resolved, './src/features/auth/components/login.js');
});

test('wildcard in target replaced multiple times', () => {
	const mock_package: Package_Json = {
		name: '',
		version: '',
		exports: {
			'./docs/*': './content/*/index.html',
		},
	};
	const resolved = resolve_subpath(mock_package, './docs/getting-started');
	assert.equal(resolved, './content/getting-started/index.html');
});

test('handles all community-defined conditions', () => {
	const exported = {
		types: './index.d.ts',
		browser: './browser.js',
		development: './dev.js',
		production: './prod.js',
		default: './index.js',
	};

	// Test types condition priority (should be first)
	assert.equal(
		resolve_exported_value(exported, ['browser', 'types']),
		'./index.d.ts',
		'types condition should take precedence',
	);

	// Test browser condition
	assert.equal(resolve_exported_value(exported, ['browser']), './browser.js');

	// Test development/production mutual exclusivity
	assert.equal(
		resolve_exported_value(exported, ['development', 'production']),
		'./dev.js',
		'development should be chosen when both present',
	);
});

test('enforces custom user condition naming restrictions', () => {
	const exported = {
		'valid-condition': './valid.js',
		'valid:condition': './valid2.js',
		'valid=condition': './valid3.js',
		'.invalid': './invalid1.js',
		'invalid,name': './invalid2.js',
		'10': './invalid3.js',
		default: './default.js',
	};

	// Valid conditions should resolve
	assert.equal(resolve_exported_value(exported, ['valid-condition']), './valid.js');
	assert.equal(resolve_exported_value(exported, ['valid:condition']), './valid2.js');
	assert.equal(resolve_exported_value(exported, ['valid=condition']), './valid3.js');

	// Invalid conditions should fall through to default
	assert.equal(
		resolve_exported_value(exported, ['.invalid']),
		'./default.js',
		'conditions starting with . should be ignored',
	);
	assert.equal(
		resolve_exported_value(exported, ['invalid,name']),
		'./default.js',
		'conditions containing , should be ignored',
	);
	assert.equal(
		resolve_exported_value(exported, ['10']),
		'./default.js',
		'numeric conditions should be ignored',
	);
});

test('handles module-sync condition with require/import interaction', () => {
	const exported = {
		'module-sync': {
			import: './sync-module.mjs',
			require: './sync-module.cjs',
		},
		import: './async-module.mjs',
		require: './async-module.cjs',
		default: './fallback.js',
	};

	// Should prioritize module-sync over import/require
	assert.equal(resolve_exported_value(exported, ['module-sync', 'import']), './sync-module.mjs');

	assert.equal(resolve_exported_value(exported, ['module-sync', 'require']), './sync-module.cjs');

	// When module-sync not in conditions, should use import/require
	assert.equal(resolve_exported_value(exported, ['import']), './async-module.mjs');

	assert.equal(resolve_exported_value(exported, ['require']), './async-module.cjs');
});

test('resolves deeply nested conditional exports', () => {
	const exported = {
		types: './index.d.ts',
		browser: {
			node: {
				development: './browser-node-dev.js',
				default: './browser-node.js',
			},
			default: {
				development: './browser-dev.js',
				default: './browser.js',
			},
		},
		default: {
			node: {
				development: './node-dev.js',
				default: './node.js',
			},
			default: {
				development: './dev.js',
				default: './index.js',
			},
		},
	};

	// Test types precedence
	assert.equal(
		resolve_exported_value(exported, ['browser', 'node', 'types']),
		'./index.d.ts',
		'types should take precedence',
	);

	// Test nested resolution with all conditions present
	assert.equal(
		resolve_exported_value(exported, ['browser', 'node', 'development']),
		'./browser-node-dev.js',
		'should resolve most specific path',
	);

	// Test fallback to default at each level
	assert.equal(
		resolve_exported_value(exported, ['browser', 'node']),
		'./browser-node.js',
		'should fallback to default when condition missing',
	);

	assert.equal(
		resolve_exported_value(exported, ['browser']),
		'./browser.js',
		'should fallback through multiple defaults',
	);

	// Test complete fallback
	assert.equal(
		resolve_exported_value(exported, ['deno']),
		'./index.js',
		'should fallback to ultimate default',
	);
});

test('respects condition evaluation order', () => {
	const exported = {
		node: {
			browser: './node-browser.js',
			default: './node.js',
		},
		browser: {
			node: './browser-node.js',
			default: './browser.js',
		},
		default: './index.js',
	};

	assert.equal(
		resolve_exported_value(exported, ['browser', 'node']),
		'./browser-node.js',
		'should evaluate conditions in specified order',
	);

	assert.equal(
		resolve_exported_value(exported, ['node', 'browser']),
		'./node-browser.js',
		'should evaluate conditions in different specified order',
	);
});

test('falls back to main field when no exports field exists', () => {
	const cache = {
		'main-fallback': {
			name: 'main-fallback',
			version: '1.0.0',
			main: './lib/index.js',
		},
	};

	const result = resolve_node_specifier('main-fallback', TEST_ROOT, undefined, cache);

	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/main-fallback/lib/index.js'));
});

test('handles self-referencing with exports field', () => {
	const cache = {
		'self-ref-pkg': {
			name: 'self-ref-pkg',
			version: '1.0.0',
			exports: {
				'.': './index.js',
				'./utils': './lib/utils.js',
			},
		},
	};

	const result = resolve_node_specifier(
		'self-ref-pkg/utils',
		TEST_ROOT,
		resolve(TEST_ROOT, 'node_modules/self-ref-pkg/src/component.js'),
		cache,
	);

	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/self-ref-pkg/lib/utils.js'));
});

test('rejects self-referencing without exports field', () => {
	const cache = {
		'no-exports-self-ref': {
			name: 'no-exports-self-ref',
			version: '1.0.0',
			main: './index.js',
		},
	};

	assert.throws(
		() =>
			resolve_node_specifier(
				'no-exports-self-ref/utils',
				TEST_ROOT,
				resolve(TEST_ROOT, 'node_modules/no-exports-self-ref/src/component.js'),
				cache,
			),
		/Self-referencing is only available if package.json has "exports" field/,
	);
});

test('handles pattern exports', () => {
	const cache = {
		'pattern-test': {
			name: 'pattern-test',
			version: '1.0.0',
			exports: {
				'./features/*.js': './src/features/*.js',
				'./features/*/index.js': './src/features/*/index.js',
				'./features/internal/*': null,
			},
		},
	};

	// Test successful pattern match
	const result1 = resolve_node_specifier(
		'pattern-test/features/auth.js',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(
		result1?.path_id,
		resolve(TEST_ROOT, 'node_modules/pattern-test/src/features/auth.js'),
	);

	// Test blocked pattern
	assert.throws(
		() =>
			resolve_node_specifier(
				'pattern-test/features/internal/secret.js',
				TEST_ROOT,
				undefined,
				cache,
			),
		/ERR_PACKAGE_PATH_NOT_EXPORTED/,
	);
});

test('handles exports with conditions', () => {
	const cache = {
		'conditions-test': {
			name: 'conditions-test',
			version: '1.0.0',
			exports: {
				'.': {
					types: './index.d.ts',
					import: './esm/index.js',
					require: './cjs/index.js',
					default: './index.js',
				},
			},
		},
	};

	// Test types condition
	const result1 = resolve_node_specifier('conditions-test', TEST_ROOT, undefined, cache, true, [
		'types',
		'import',
	]);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/conditions-test/index.js')); // Note: .d.ts gets transformed to .js

	// Test import condition
	const result2 = resolve_node_specifier('conditions-test', TEST_ROOT, undefined, cache, true, [
		'import',
	]);
	assert.equal(result2?.path_id, resolve(TEST_ROOT, 'node_modules/conditions-test/esm/index.js'));
});

test('handles nested conditions with pattern exports', () => {
	const cache = {
		'nested-conditions': {
			name: 'nested-conditions',
			version: '1.0.0',
			exports: {
				'./components/*.js': {
					types: './types/components/*.d.ts',
					import: {
						development: './dev/components/*.js',
						production: './prod/components/*.js',
					},
					require: './cjs/components/*.js',
				},
			},
		},
	};

	// Test development condition
	const result1 = resolve_node_specifier(
		'nested-conditions/components/button.js',
		TEST_ROOT,
		undefined,
		cache,
		true,
		['import', 'development'],
	);
	assert.equal(
		result1?.path_id,
		resolve(TEST_ROOT, 'node_modules/nested-conditions/dev/components/button.js'),
	);

	// Test production condition
	const result2 = resolve_node_specifier(
		'nested-conditions/components/button.js',
		TEST_ROOT,
		undefined,
		cache,
		true,
		['import', 'production'],
	);
	assert.equal(
		result2?.path_id,
		resolve(TEST_ROOT, 'node_modules/nested-conditions/prod/components/button.js'),
	);
});

test('exports field takes precedence over main', () => {
	const cache = {
		'precedence-test': {
			name: 'precedence-test',
			version: '1.0.0',
			main: './old-main.js',
			exports: {
				'.': './new-main.js',
			},
		},
	};

	const result = resolve_node_specifier('precedence-test', TEST_ROOT, undefined, cache);

	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/precedence-test/new-main.js'));
});

test('handles complex pattern matching precedence', () => {
	const cache = {
		'pattern-precedence': {
			name: 'pattern-precedence',
			version: '1.0.0',
			exports: {
				'./dist/exact.js': './built/exact.js', // exact match
				'./dist/*/specific/*.js': './src/*/exact/*.js', // more specific pattern
				'./dist/*/*.js': './src/*/*.js', // less specific pattern
			},
		},
	};

	// Test exact match
	const result1 = resolve_node_specifier(
		'pattern-precedence/dist/exact.js',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(
		result1?.path_id,
		resolve(TEST_ROOT, 'node_modules/pattern-precedence/built/exact.js'),
	);

	// Test specific pattern
	const result2 = resolve_node_specifier(
		'pattern-precedence/dist/auth/specific/login.js',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(
		result2?.path_id,
		resolve(TEST_ROOT, 'node_modules/pattern-precedence/src/auth/exact/login.js'),
	);

	// Test general pattern
	const result3 = resolve_node_specifier(
		'pattern-precedence/dist/utils/helpers.js',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(
		result3?.path_id,
		resolve(TEST_ROOT, 'node_modules/pattern-precedence/src/utils/helpers.js'),
	);
});

test('handles extensionless imports', () => {
	const cache = {
		'extension-test': {
			name: 'extension-test',
			version: '1.0.0',
			exports: {
				'.': './index', // no extension
				'./lib': './src/lib', // no extension
			},
		},
	};

	const result = resolve_node_specifier('extension-test', TEST_ROOT, undefined, cache);

	// Should attempt to add .js extension
	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/extension-test/index.js'));
});

test('handles scoped package resolution', () => {
	const cache = {
		'@scope/package': {
			name: '@scope/package',
			version: '1.0.0',
			exports: {
				'.': './index.js',
				'./feature': './lib/feature.js',
			},
		},
	};

	const result = resolve_node_specifier('@scope/package/feature', TEST_ROOT, undefined, cache);

	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/@scope/package/lib/feature.js'));
});

// TODO resolve self-referencing

test.run();
