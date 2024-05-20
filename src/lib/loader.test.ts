import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

test('import js', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.js'));
	assert.ok(imported);
	assert.is(imported.a, 'ok');
});

test('import ts', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.ts'));
	assert.ok(imported);
	assert.is(imported.a, 'ok');
});

test('import json', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_json.json'));
	assert.ok(imported);
	assert.is(imported.default.a, 'ok');
});

test('import css as a no-op', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_css.css'));
	assert.is(typeof imported.default, 'string');
	assert.ok(imported);
});

test('import svelte', async () => {
	const imported = await import(resolve('src/fixtures/modules/Some_Test_Svelte.svelte'));
	assert.ok(imported);
	assert.is(imported.a, 'ok');
});

test('import svelte.js', async () => {
	// TODO BLOCK
	// const imported = await import(resolve('src/fixtures/modules/some_test_svelte_js.js'));
	// console.log(`imported`, imported);
	// assert.ok(imported);
});

test('import svelte.ts', async () => {
	// TODO BLOCK
	// const imported = await import(resolve('src/fixtures/modules/some_test_svelte_ts.svelte.ts'));
	// console.log(`imported`, imported);
	// assert.ok(imported);
});

test.run();
