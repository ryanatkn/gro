import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	Package_Json,
	load_package_json,
	parse_repo_url,
	serialize_package_json,
	to_package_exports,
} from './package_json.js';

test('load_package_json', async () => {
	const package_json = await load_package_json();
	assert.ok(package_json);
	const parsed = Package_Json.parse(package_json);
	assert.ok(parsed);
	serialize_package_json(package_json);
});

test('load_package_json with cache', async () => {
	const cache = {};
	const package_json1 = await load_package_json(undefined, cache);
	assert.ok(package_json1);
	assert.is(Object.keys(cache).length, 1);
	const package_json2 = await load_package_json(undefined, cache);
	assert.is(Object.keys(cache).length, 1);
	assert.is(package_json1, package_json2);
});

test('Package_Json.parse', async () => {
	Package_Json.parse({name: 'abc', version: '123'});
});

test('Package_Json.parse fails with bad data', async () => {
	let err;
	try {
		Package_Json.parse({version: '123'});
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test('serialize_package_json', async () => {
	serialize_package_json({name: 'abc', version: '123'});
});

test('serialize_package_json fails with bad data', async () => {
	let err;
	try {
		serialize_package_json({version: '123'} as any);
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test('to_package_exports', async () => {
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

test('parse_repo_url', async () => {
	const parsed = parse_repo_url(await load_package_json());
	assert.is(parsed?.owner, 'ryanatkn');
	assert.is(parsed?.repo, 'gro');
});

test.run();
