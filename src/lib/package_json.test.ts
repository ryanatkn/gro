import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	Package_Json,
	load_package_json,
	serialize_package_json,
	to_package_exports,
	to_package_modules,
} from './package_json.js';
import {paths} from './paths.js';

test('load_package_json', async () => {
	const pkg = await load_package_json();
	assert.ok(pkg);
	const parsed = Package_Json.parse(pkg);
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
		]),
		{
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

test('to_package_modules', async () => {
	assert.equal(
		await to_package_modules(
			to_package_exports([
				'fixtures/modules/some_test_css.css',
				'fixtures/modules/Some_Test_Svelte.svelte',
				'fixtures/modules/some_test_ts.ts',
				'fixtures/modules/some_test_json.json',
			]),
			undefined,
			paths.source,
		),
		{
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
					{
						name: 'some_test_ts',
						kind: 'variable',
					},
					{
						name: 'Some_Test_Type',
						kind: 'type',
					},
				],
			},
		},
	);
});

test.run();
