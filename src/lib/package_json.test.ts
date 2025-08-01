import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {Package_Json, Package_Json_Exports} from '@ryanatkn/belt/package_helpers.js';

import {
	load_package_json,
	parse_repo_url,
	serialize_package_json,
	to_package_exports,
} from './package_json.ts';

test('load_package_json', () => {
	const package_json = load_package_json();
	assert.ok(package_json);
	const parsed = Package_Json.parse(package_json);
	assert.ok(parsed);
	serialize_package_json(package_json);
});

test('load_package_json with cache', () => {
	const cache = {};
	const package_json1 = load_package_json(undefined, cache);
	assert.ok(package_json1);
	assert.is(Object.keys(cache).length, 1);
	const package_json2 = load_package_json(undefined, cache);
	assert.is(Object.keys(cache).length, 1);
	assert.is(package_json1, package_json2);
});

test('Package_Json.parse', () => {
	Package_Json.parse({name: 'abc', version: '123'});
});

test('Package_Json.parse fails with bad data', () => {
	let err;
	try {
		Package_Json.parse({version: '123'});
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test('serialize_package_json', () => {
	serialize_package_json({name: 'abc', version: '123'});
});

test('serialize_package_json fails with bad data', () => {
	let err;
	try {
		serialize_package_json({version: '123'} as any);
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test('to_package_exports', () => {
	assert.equal(to_package_exports(['a/b.ts']), {
		'./package.json': './package.json',
		'./a/b.js': {
			default: './dist/a/b.js',
			types: './dist/a/b.d.ts',
		},
	});
	assert.equal(
		to_package_exports([
			'a/b/Some_Test_Svelte.svelte',
			'a/b/some_test_ts.ts',
			'a/b/some_test_json.json',
			'index.ts',
		]),
		{
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
			'./package.json': './package.json',
			'./a/b/some_test_json.json': {
				default: './dist/a/b/some_test_json.json',
			},
			'./a/b/Some_Test_Svelte.svelte': {
				svelte: './dist/a/b/Some_Test_Svelte.svelte',
				default: './dist/a/b/Some_Test_Svelte.svelte',
				types: './dist/a/b/Some_Test_Svelte.svelte.d.ts',
			},
			'./a/b/some_test_ts.js': {
				default: './dist/a/b/some_test_ts.js',
				types: './dist/a/b/some_test_ts.d.ts',
			},
		},
	);
});

test('parse_repo_url', () => {
	const parsed = parse_repo_url(load_package_json());
	assert.is(parsed?.owner, 'ryanatkn');
	assert.is(parsed?.repo, 'gro');
});

test('`Package_Json_Exports` parses simple string exports', () => {
	const exports = {
		'.': './index.js',
		'./lib': './lib/index.js',
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	assert.ok(parsed.success);
	assert.equal(exports, parsed.data);
});

test('`Package_Json_Exports` parses null exports', () => {
	const exports = {
		'.': './index.js',
		'./internal/*': null,
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	assert.ok(parsed.success);
	assert.equal(exports, parsed.data);
});

test('`Package_Json_Exports` parses basic conditional exports', () => {
	const exports = {
		'.': {
			import: './index.mjs',
			require: './index.cjs',
			default: './index.js',
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	assert.ok(parsed.success);
	assert.equal(exports, parsed.data);
});

test('`Package_Json_Exports` parses nested conditional exports', () => {
	const exports = {
		'./feature': {
			node: {
				import: './feature-node.mjs',
				require: './feature-node.cjs',
			},
			default: './feature.mjs',
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	assert.ok(parsed.success);
	assert.equal(exports, parsed.data);
});

test('`Package_Json_Exports` parses deeply nested conditional exports', () => {
	const exports = {
		'./advanced': {
			node: {
				development: {
					import: './dev-node.mjs',
					require: './dev-node.cjs',
				},
				production: {
					import: './prod-node.mjs',
					require: './prod-node.cjs',
				},
			},
			default: './feature.mjs',
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	assert.ok(parsed.success);
	assert.equal(exports, parsed.data);
});

test('`Package_Json_Exports` parses mixed exports types', () => {
	const exports = {
		'.': './index.js',
		'./lib': {
			node: './lib/node.js',
			default: './lib/index.js',
		},
		'./feature/*': null,
		'./advanced': {
			node: {
				import: './advanced-node.mjs',
				require: './advanced-node.cjs',
			},
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	assert.ok(parsed.success);
	assert.equal(exports, parsed.data);
});

test('rejects invalid exports', () => {
	const invalid_exports = [
		{
			'.': true, // boolean is not a valid export value
		},
		{
			'.': ['/path'], // array is not a valid export value
		},
		{
			'.': {
				default: true, // boolean is not a valid export value in conditions
			},
		},
		{
			'.': {
				node: {
					import: ['/path'], // array is not a valid nested export value
				},
			},
		},
	];

	for (const invalid_export of invalid_exports) {
		const parsed = Package_Json_Exports.safeParse(invalid_export);
		assert.ok(!parsed.success);
	}
});

test.run();
