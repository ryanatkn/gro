import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';

test('import .js', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.js'));
	assert.ok(imported);
	assert.is(imported.a, 'ok');
});

test('import .ts', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.ts'));
	assert.ok(imported);
	assert.is(imported.a, 'ok');
});

test.only('import raw .ts', async () => {
	const path = resolve('src/fixtures/modules/some_test_ts.ts');
	const imported = await import(path + '?raw');
	assert.ok(imported);
	assert.equal(imported.default, readFileSync(path, 'utf8'));
});

test('import .json', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_json.json'));
	assert.ok(imported);
	assert.is(imported.default.a, 'ok');
});

test('import .css as a no-op', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_css.css'));
	assert.is(typeof imported.default, 'string');
	assert.ok(imported);
});

test('import .svelte', async () => {
	const imported = await import(resolve('src/fixtures/modules/Some_Test_Svelte.svelte'));
	assert.ok(imported);
	assert.is(imported.a, 'ok');
});

test('import raw .svelte', async () => {
	const path = resolve('src/fixtures/modules/Some_Test_Svelte.svelte');
	const imported = await import(path + '?raw');
	assert.ok(imported);
	assert.equal(imported.default, readFileSync(path, 'utf8'));
});

test('import .svelte.js', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_svelte_js.svelte.js'));
	assert.ok(imported.Some_Test_Svelte_Js);
	const instance = new imported.Some_Test_Svelte_Js();
	assert.is(instance.a, 'ok');
});

test('import .svelte.ts', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_svelte_ts.svelte.ts'));
	assert.ok(imported.Some_Test_Svelte_Ts);
	const instance = new imported.Some_Test_Svelte_Ts();
	assert.is(instance.a, 'ok');
});

test.run();
