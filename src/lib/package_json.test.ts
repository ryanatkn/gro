import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	PackageJson,
	load_package_json,
	serialize_package_json,
	to_package_exports,
	to_package_modules,
} from './package_json.js';

test('load_package_json', async () => {
	const pkg = await load_package_json();
	assert.ok(pkg);
	const parsed = PackageJson.parse(pkg);
	assert.ok(parsed);
	serialize_package_json(pkg);
});

test('load_package_json with cache', async () => {
	const cache = {};
	const pkg1 = await load_package_json(undefined, cache);
	assert.ok(pkg1);
	assert.is(Object.keys(cache).length, 1);
	const pkg2 = await load_package_json(undefined, cache);
	assert.is(Object.keys(cache).length, 1);
	assert.is(pkg1, pkg2);
});

test('PackageJson.parse', async () => {
	PackageJson.parse({name: 'abc', version: '123'});
});

test('PackageJson.parse fails with bad data', async () => {
	let err;
	try {
		PackageJson.parse({version: '123'});
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
		'./a/b.js': {
			default: './dist/a/b.js',
			types: './dist/a/b.d.ts',
		},
	});
	assert.equal(
		to_package_exports([
			'fixtures/Some_Test_Svelte.svelte',
			'fixtures/some_test_ts.ts',
			'fixtures/some_test_json.json',
		]),
		{
			'./fixtures/some_test_json.json': {
				default: './dist/fixtures/some_test_json.json',
			},
			'./fixtures/Some_Test_Svelte.svelte': {
				svelte: './dist/fixtures/Some_Test_Svelte.svelte',
				default: './dist/fixtures/Some_Test_Svelte.svelte',
				types: './dist/fixtures/Some_Test_Svelte.svelte.d.ts',
			},
			'./fixtures/some_test_ts.js': {
				default: './dist/fixtures/some_test_ts.js',
				types: './dist/fixtures/some_test_ts.d.ts',
			},
		},
	);
});

// TODO BLOCK don't include packages that don't have @sveltejs/package

test('to_package_modules', async () => {
	console.log(
		`to_package_exports`,
		to_package_exports([
			'fixtures/some_test_css.css',
			'fixtures/Some_Test_Svelte.svelte',
			'fixtures/some_test_ts.ts',
			'fixtures/some_test_json.json',
		]),
	);
	assert.equal(
		to_package_modules(
			to_package_exports([
				'fixtures/some_test_css.css',
				'fixtures/Some_Test_Svelte.svelte',
				'fixtures/some_test_ts.ts',
				'fixtures/some_test_json.json',
			]),
		),
		{},
	);
});

test.run();
