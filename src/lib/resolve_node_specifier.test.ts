import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {resolve_node_specifier} from './resolve_node_specifier.js';

const TEST_ROOT = process.cwd();

test('requires either main or exports field for package resolution', () => {
	const cache = {
		'no-entry': {
			name: 'no-entry',
			version: '',
			// No main or exports
		},
	};
	assert.throws(
		() => resolve_node_specifier('no-entry', TEST_ROOT, undefined, cache),
		/ERR_PACKAGE_PATH_NOT_EXPORTED/,
	);
});

test('handles exports vs main priority', () => {
	const cache = {
		'main-only': {
			name: 'main-only',
			version: '',
			main: './lib/index.js',
		},
		'exports-only': {
			name: 'exports-only',
			version: '',
			exports: './index.js',
		},
		'both-fields': {
			name: 'both-fields',
			version: '',
			main: './lib/main.js',
			exports: './dist/index.js',
		},
	};

	// Main field works when no exports
	const result1 = resolve_node_specifier('main-only', TEST_ROOT, undefined, cache);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/main-only/lib/index.js'));

	// Exports works alone
	const result2 = resolve_node_specifier('exports-only', TEST_ROOT, undefined, cache);
	assert.equal(result2?.path_id, resolve(TEST_ROOT, 'node_modules/exports-only/index.js'));

	// Exports takes precedence over main
	const result3 = resolve_node_specifier('both-fields', TEST_ROOT, undefined, cache);
	assert.equal(result3?.path_id, resolve(TEST_ROOT, 'node_modules/both-fields/dist/index.js'));
});

test('handles scoped package resolution', () => {
	const cache = {
		'@scope/package': {
			name: '@scope/package',
			version: '',
			exports: {
				'.': './index.js',
				'./feature': './lib/feature.js',
			},
		},
	};

	const result = resolve_node_specifier('@scope/package/feature', TEST_ROOT, undefined, cache);
	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/@scope/package/lib/feature.js'));
});

test('enforces strict condition order per Node.js spec', () => {
	const cache = {
		conditions: {
			name: 'conditions',
			version: '',
			exports: {
				'.': {
					'node-addons': './native.node',
					node: './node.js',
					import: './esm.mjs',
					require: './cjs.cjs',
					'module-sync': './sync.js',
					default: './default.js',
				},
			},
		},
	};

	// node-addons highest priority
	const result1 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, [
		'require',
		'node',
		'node-addons',
	]);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/native.node'));

	// require should win when listed before import
	const result3 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, [
		'require',
		'import',
	]);
	assert.equal(
		result3?.path_id,
		resolve(TEST_ROOT, 'node_modules/conditions/cjs.cjs'),
		'require should win when listed before import',
	);
});

test('handles nested conditions with proper order', () => {
	const cache = {
		nested: {
			name: 'nested',
			version: '',
			exports: {
				'.': {
					import: {
						node: './import/node.js',
						default: './import/default.js',
					},
					node: {
						import: './node/esm.mjs',
						default: './node/default.js',
					},
					default: './fallback.js',
				},
			},
		},
	};

	const result = resolve_node_specifier('nested', TEST_ROOT, undefined, cache, true, [
		'import',
		'node',
	]);
	assert.equal(
		result?.path_id,
		resolve(TEST_ROOT, 'node_modules/nested/import/node.js'),
		'import condition should be evaluated first when specified first',
	);
});

test('handles pattern exports with proper precedence', () => {
	const cache = {
		patterns: {
			name: 'patterns',
			version: '',
			exports: {
				'./dist/exact.js': './build/exact.js', // Most specific (exact)
				'./dist/*/specific/*.js': './src/*/exact/*.js', // More specific pattern
				'./dist/*/*.js': './src/*/*.js', // Less specific pattern
				'./dist/*.js': './src/*.js', // Generic pattern
				'./dist/*': './src/*', // Fallback pattern
				'./dist/internal/*': null, // Blocked pattern
			},
		},
	};

	// Exact match wins
	const result1 = resolve_node_specifier('patterns/dist/exact.js', TEST_ROOT, undefined, cache);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/patterns/build/exact.js'));

	// More specific pattern wins over generic
	const result2 = resolve_node_specifier(
		'patterns/dist/auth/specific/login.js',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(
		result2?.path_id,
		resolve(TEST_ROOT, 'node_modules/patterns/src/auth/exact/login.js'),
	);

	// Less specific pattern when others don't match
	const result3 = resolve_node_specifier(
		'patterns/dist/utils/helper.js',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(result3?.path_id, resolve(TEST_ROOT, 'node_modules/patterns/src/utils/helper.js'));

	// Blocked pattern takes precedence
	assert.throws(
		() => resolve_node_specifier('patterns/dist/internal/secret.js', TEST_ROOT, undefined, cache),
		/ERR_PACKAGE_PATH_NOT_EXPORTED/,
	);
});

test('handles patterns with multiple wildcards', () => {
	const cache = {
		'multi-patterns': {
			name: 'multi-patterns',
			version: '',
			exports: {
				'./features/*/*/components/*.js': './src/features/*/*/components/*.js',
				'./lib/**/*.js': './src/lib/**/*.js',
			},
		},
	};

	const result = resolve_node_specifier(
		'multi-patterns/features/auth/v1/components/login.js',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(
		result?.path_id,
		resolve(TEST_ROOT, 'node_modules/multi-patterns/src/features/auth/v1/components/login.js'),
	);
});

test('handles pattern conditions properly', () => {
	const cache = {
		'pattern-conditions': {
			name: 'pattern-conditions',
			version: '',
			exports: {
				'./lib/*.js': {
					'node-addons': './addons/*/addon.node',
					node: './node/*/*.js',
					import: './esm/*/*.mjs',
					require: './cjs/*/*.cjs',
					default: './src/*/*.js',
				},
			},
		},
	};

	const result = resolve_node_specifier(
		'pattern-conditions/lib/utils.js',
		TEST_ROOT,
		undefined,
		cache,
		true,
		['node-addons', 'import'],
	);
	assert.equal(
		result?.path_id,
		resolve(TEST_ROOT, 'node_modules/pattern-conditions/addons/utils/addon.node'),
	);
});

test('handles extensionless imports', () => {
	const cache = {
		extensions: {
			name: 'extensions',
			version: '',
			exports: {
				'.': './index', // No extension
				'./lib': './src/lib', // No extension subpath
				'./components/*': './src/*.js', // Pattern adds extension
				'./utils/*.js': './lib/*', // Pattern removes extension
			},
		},
	};

	// Adds .js to main
	const result1 = resolve_node_specifier('extensions', TEST_ROOT, undefined, cache);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/extensions/index.js'));

	// Adds .js to subpath
	const result2 = resolve_node_specifier('extensions/lib', TEST_ROOT, undefined, cache);
	assert.equal(result2?.path_id, resolve(TEST_ROOT, 'node_modules/extensions/src/lib.js'));

	// Pattern adds extension
	const result3 = resolve_node_specifier(
		'extensions/components/button',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(result3?.path_id, resolve(TEST_ROOT, 'node_modules/extensions/src/button.js'));

	// Pattern preserves extension
	const result4 = resolve_node_specifier('extensions/utils/helper.js', TEST_ROOT, undefined, cache);
	assert.equal(result4?.path_id, resolve(TEST_ROOT, 'node_modules/extensions/lib/helper.js'));
});

test('handles typescript definition files', () => {
	const cache = {
		types: {
			name: 'types',
			version: '',
			exports: {
				'.': {
					types: './index.d.ts',
					default: './index.js',
				},
			},
		},
	};

	const result = resolve_node_specifier('types', TEST_ROOT, undefined, cache, true, ['types']);
	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/types/index.js'));
});

test('handles self-referencing with proper constraints', () => {
	const cache = {
		'self-ref': {
			name: 'self-ref',
			version: '',
			exports: {
				'.': './index.js',
				'./utils': './lib/utils.js',
			},
		},
		'no-exports': {
			name: 'no-exports',
			version: '',
			main: './index.js',
		},
	};

	// Allow self-reference with exports
	const parent_path = resolve(TEST_ROOT, 'node_modules/self-ref/src/component.js');
	const result1 = resolve_node_specifier('self-ref', TEST_ROOT, parent_path, cache);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/self-ref/index.js'));

	// Block self-reference without exports
	const invalid_parent = resolve(TEST_ROOT, 'node_modules/no-exports/src/component.js');
	assert.throws(
		() => resolve_node_specifier('no-exports', TEST_ROOT, invalid_parent, cache),
		/Self-referencing is only available if package.json has "exports" field/,
	);
});

test('handles scoped package self-referencing', () => {
	const cache = {
		'@scope/pkg': {
			name: '@scope/pkg',
			version: '',
			exports: {
				'.': './index.js',
				'./feature': './lib/feature.js',
			},
		},
	};

	const parent_path = resolve(TEST_ROOT, 'node_modules/@scope/pkg/src/component.js');
	const result = resolve_node_specifier('@scope/pkg/feature', TEST_ROOT, parent_path, cache);
	assert.equal(result?.path_id, resolve(TEST_ROOT, 'node_modules/@scope/pkg/lib/feature.js'));
});

test('properly handles invalid exports targets', () => {
	const cache = {
		'invalid-exports': {
			name: 'invalid-exports',
			version: '',
			exports: {
				'.': './node_modules/other-pkg/index.js', // Invalid - contains node_modules
			},
		},
		'boundary-escape': {
			name: 'boundary-escape',
			version: '',
			exports: {
				'.': '../../../escape/file.js', // Invalid - escapes package boundary
			},
		},
	};

	assert.throws(
		() => resolve_node_specifier('invalid-exports', TEST_ROOT, undefined, cache),
		/ERR_INVALID_PACKAGE_TARGET.*cannot contain node_modules/,
	);

	assert.throws(
		() => resolve_node_specifier('boundary-escape', TEST_ROOT, undefined, cache),
		/ERR_INVALID_PACKAGE_TARGET.*cannot escape package boundary/,
	);
});

test('handles non-existent packages and exports', () => {
	const cache = {
		pkg: {
			name: 'pkg',
			version: '',
			exports: {
				'./utils': './lib/utils.js',
			},
		},
	};

	// Non-existent package
	assert.throws(
		() => resolve_node_specifier('non-existent', TEST_ROOT, undefined, cache),
		/Package not found/,
	);

	// Non-existent export
	assert.throws(
		() => resolve_node_specifier('pkg/non-existent', TEST_ROOT, undefined, cache),
		/ERR_PACKAGE_PATH_NOT_EXPORTED/,
	);
});

// Continuing from the previous test file...

test('validates custom condition names', () => {
	const cache = {
		conditions: {
			name: 'conditions',
			version: '',
			exports: {
				'.': {
					'valid-name': './valid1.js',
					'valid:name': './valid2.js',
					'valid=name': './valid3.js',
					'.invalid': './invalid1.js', // Invalid - starts with dot
					'invalid,name': './invalid2.js', // Invalid - contains comma
					'123': './invalid3.js', // Invalid - numeric
					'': './invalid4.js', // Invalid - empty
					default: './default.js',
				},
			},
		},
	};

	// Valid conditions work
	const result1 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, [
		'valid-name',
	]);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/valid1.js'));

	const result2 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, [
		'valid:name',
	]);
	assert.equal(result2?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/valid2.js'));

	const result3 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, [
		'valid=name',
	]);
	assert.equal(result3?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/valid3.js'));

	// Invalid conditions fall through to default
	const result4 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, [
		'.invalid',
	]);
	assert.equal(result4?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/default.js'));

	const result5 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, [
		'invalid,name',
	]);
	assert.equal(result5?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/default.js'));

	const result6 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, ['123']);
	assert.equal(result6?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/default.js'));

	const result7 = resolve_node_specifier('conditions', TEST_ROOT, undefined, cache, true, ['']);
	assert.equal(result7?.path_id, resolve(TEST_ROOT, 'node_modules/conditions/default.js'));
});

test('handles community-defined conditions', () => {
	const cache = {
		'community-conditions': {
			name: 'community-conditions',
			version: '',
			exports: {
				'.': {
					types: './types/index.d.ts', // Should be first
					browser: './browser/index.js',
					development: './dev/index.js',
					production: './prod/index.js',
					default: './index.js',
				},
			},
		},
	};

	// types has highest priority
	const result1 = resolve_node_specifier(
		'community-conditions',
		TEST_ROOT,
		undefined,
		cache,
		true,
		['browser', 'types'],
	);
	assert.equal(
		result1?.path_id,
		resolve(TEST_ROOT, 'node_modules/community-conditions/types/index.js'),
	);

	// development/production are mutually exclusive
	const result2 = resolve_node_specifier(
		'community-conditions',
		TEST_ROOT,
		undefined,
		cache,
		true,
		['development', 'production'],
	);
	assert.equal(
		result2?.path_id,
		resolve(TEST_ROOT, 'node_modules/community-conditions/dev/index.js'),
	);

	// browser condition works
	const result3 = resolve_node_specifier(
		'community-conditions',
		TEST_ROOT,
		undefined,
		cache,
		true,
		['browser'],
	);
	assert.equal(
		result3?.path_id,
		resolve(TEST_ROOT, 'node_modules/community-conditions/browser/index.js'),
	);
});

test('handles exports sugar syntax variations', () => {
	const cache = {
		'sugar-simple': {
			name: 'sugar-simple',
			version: '',
			exports: './index.js', // Direct string
		},
		'sugar-object': {
			name: 'sugar-object',
			version: '',
			exports: {
				'.': './index.js', // Object form
			},
		},
		'sugar-conditions': {
			name: 'sugar-conditions',
			version: '',
			exports: {
				'.': {
					import: './index.mjs', // With conditions
					require: './index.cjs',
					default: './index.js',
				},
			},
		},
	};

	// Direct string form works
	const result1 = resolve_node_specifier('sugar-simple', TEST_ROOT, undefined, cache);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/sugar-simple/index.js'));

	// Object form works identically
	const result2 = resolve_node_specifier('sugar-object', TEST_ROOT, undefined, cache);
	assert.equal(result2?.path_id, resolve(TEST_ROOT, 'node_modules/sugar-object/index.js'));

	// Conditional form works
	const result3 = resolve_node_specifier('sugar-conditions', TEST_ROOT, undefined, cache, true, [
		'import',
	]);
	assert.equal(result3?.path_id, resolve(TEST_ROOT, 'node_modules/sugar-conditions/index.mjs'));
});

test('enforces complete package encapsulation', () => {
	const cache = {
		encapsulated: {
			name: 'encapsulated',
			version: '',
			exports: {
				'.': './index.js',
				'./public': './src/public/index.js',
				'./features/*': './src/features/*.js',
			},
		},
	};

	// Listed exports work
	const result1 = resolve_node_specifier('encapsulated', TEST_ROOT, undefined, cache);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/encapsulated/index.js'));

	const result2 = resolve_node_specifier('encapsulated/public', TEST_ROOT, undefined, cache);
	assert.equal(
		result2?.path_id,
		resolve(TEST_ROOT, 'node_modules/encapsulated/src/public/index.js'),
	);

	// Unlisted paths are blocked
	assert.throws(
		() => resolve_node_specifier('encapsulated/src/secret.js', TEST_ROOT, undefined, cache),
		/ERR_PACKAGE_PATH_NOT_EXPORTED/,
	);

	assert.throws(
		() => resolve_node_specifier('encapsulated/package.json', TEST_ROOT, undefined, cache),
		/ERR_PACKAGE_PATH_NOT_EXPORTED/,
	);
});

test('handles optional resolution mode', () => {
	const cache = {
		pkg: {
			name: 'pkg',
			version: '',
			exports: {
				'./utils': './lib/utils.js',
			},
		},
	};

	// Non-existent package returns null
	assert.is(resolve_node_specifier('non-existent', TEST_ROOT, undefined, cache, false), null);

	// Non-existent export returns null
	assert.is(resolve_node_specifier('pkg/non-existent', TEST_ROOT, undefined, cache, false), null);

	// Node core modules return null
	assert.is(resolve_node_specifier('node:path', undefined, undefined, undefined, false), null);
});

test('ignores query parameters', () => {
	const cache = {
		'raw-pkg': {
			name: 'raw-pkg',
			version: '',
			exports: {
				'./file.js': './dist/file.js',
				'./style.css': './dist/style.css',
			},
		},
	};

	// Test JS raw import
	const result1 = resolve_node_specifier('raw-pkg/file.js?raw', TEST_ROOT, undefined, cache);
	assert.equal(
		result1?.path_id_with_querystring,
		resolve(TEST_ROOT, 'node_modules/raw-pkg/dist/file.js?raw'),
	);
	assert.equal(result1?.raw, true);

	// Test CSS raw import
	const result2 = resolve_node_specifier('raw-pkg/style.css?raw', TEST_ROOT, undefined, cache);
	assert.equal(
		result2?.path_id_with_querystring,
		resolve(TEST_ROOT, 'node_modules/raw-pkg/dist/style.css?raw'),
	);
	assert.equal(result2?.raw, true);
});

// Framework-specific resolution
test('handles framework-specific file extensions', () => {
	const cache = {
		'framework-pkg': {
			name: 'framework-pkg',
			version: '',
			exports: {
				'./Component.svelte': './dist/Component.svelte',
				'./Feature.vue': './src/Feature.vue',
				'./Widget.jsx': './lib/Widget.jsx',
			},
		},
	};

	// Svelte
	const result1 = resolve_node_specifier(
		'framework-pkg/Component.svelte',
		TEST_ROOT,
		undefined,
		cache,
	);
	assert.equal(
		result1?.path_id,
		resolve(TEST_ROOT, 'node_modules/framework-pkg/dist/Component.svelte'),
	);

	// Vue
	const result2 = resolve_node_specifier('framework-pkg/Feature.vue', TEST_ROOT, undefined, cache);
	assert.equal(result2?.path_id, resolve(TEST_ROOT, 'node_modules/framework-pkg/src/Feature.vue'));

	// JSX
	const result3 = resolve_node_specifier('framework-pkg/Widget.jsx', TEST_ROOT, undefined, cache);
	assert.equal(result3?.path_id, resolve(TEST_ROOT, 'node_modules/framework-pkg/lib/Widget.jsx'));
});

// Additional pattern-based self-referencing
test('handles pattern-based self-referencing', () => {
	const cache = {
		'self-pattern': {
			name: 'self-pattern',
			version: '',
			exports: {
				'./components/*': './src/components/*.js',
				'./utils/*.js': './lib/utils/*.js',
			},
		},
	};

	const parent_path = resolve(TEST_ROOT, 'node_modules/self-pattern/src/app.js');

	// Test component pattern self-reference
	const result1 = resolve_node_specifier(
		'self-pattern/components/button',
		TEST_ROOT,
		parent_path,
		cache,
	);
	assert.equal(
		result1?.path_id,
		resolve(TEST_ROOT, 'node_modules/self-pattern/src/components/button.js'),
	);

	// Test utils pattern self-reference
	const result2 = resolve_node_specifier(
		'self-pattern/utils/format.js',
		TEST_ROOT,
		parent_path,
		cache,
	);
	assert.equal(
		result2?.path_id,
		resolve(TEST_ROOT, 'node_modules/self-pattern/lib/utils/format.js'),
	);
});

test('handles complex module-sync scenarios', () => {
	const cache = {
		'sync-pkg': {
			name: 'sync-pkg',
			version: '',
			exports: {
				'.': {
					import: './async/esm.mjs',
					require: './async/cjs.cjs',
					'module-sync': './sync/esm.js',
					default: './default.js',
				},
			},
		},
	};

	// Test that import takes precedence over module-sync
	const result1 = resolve_node_specifier('sync-pkg', TEST_ROOT, undefined, cache, true, [
		'module-sync',
		'import',
	]);
	assert.equal(result1?.path_id, resolve(TEST_ROOT, 'node_modules/sync-pkg/async/esm.mjs'));

	// Test module-sync when import/require not present
	const result2 = resolve_node_specifier('sync-pkg', TEST_ROOT, undefined, cache, true, [
		'module-sync',
	]);
	assert.equal(result2?.path_id, resolve(TEST_ROOT, 'node_modules/sync-pkg/sync/esm.js'));
});

test.run();
