import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';

const JSON_FIXTURE = 'src/fixtures/modules/some_test_json.json';

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

test('import raw .ts', async () => {
	const path = resolve('src/fixtures/modules/some_test_ts.ts');
	const imported = await import(path + '?raw');
	assert.ok(imported);
	assert.equal(imported.default, readFileSync(path, 'utf8'));
});

test('import .json', async () => {
	const path = resolve(JSON_FIXTURE);
	const imported = await import(path, {with: {type: 'json'}}); // import attribute is required
	assert.ok(imported);
	assert.is(imported.default.a, 'ok');
	assert.equal(imported.default, JSON.parse(readFileSync(path, 'utf8')));
});

test('fail to import .json without the import attribute', async () => {
	let imported;
	let err;
	try {
		imported = await import(resolve(JSON_FIXTURE)); // intentionally missing the import attribute and expecting failure
	} catch (error) {
		err = error;
	}
	assert.ok(err);
	assert.not.ok(imported);
});

test('import raw .css', async () => {
	const path = resolve('src/fixtures/modules/some_test_css.css');
	const imported = await import(path);
	assert.is(typeof imported.default, 'string');
	assert.equal(imported.default, readFileSync(path, 'utf8'));
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
