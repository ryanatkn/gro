import {test, expect} from 'vitest';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';

const JSON_FIXTURE = 'src/fixtures/modules/some_test_json.json';
const JSON_WITHOUT_EXTENSION_FIXTURE = 'src/fixtures/modules/some_test_json_without_extension';

test('import .js', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.js'));
	expect(imported).toBeTruthy();
	expect(imported.a).toBe('ok');
});

test('import .ts', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.ts'));
	expect(imported).toBeTruthy();
	expect(imported.a).toBe('ok');
});

test('import raw .ts', async () => {
	const path = resolve('src/fixtures/modules/some_test_ts.ts');
	const imported = await import(path + '?raw');
	expect(imported).toBeTruthy();
	expect(imported.default).toEqual(readFileSync(path, 'utf8'));
});

test('import .json', async () => {
	const path = resolve(JSON_FIXTURE);
	const imported = await import(path, {with: {type: 'json'}}); // import attribute is required
	expect(imported).toBeTruthy();
	expect(imported.default.a).toBe('ok');
	expect(imported.default).toEqual(JSON.parse(readFileSync(path, 'utf8')));
});

test('import json that doesnt end with .json', async () => {
	const path = resolve(JSON_WITHOUT_EXTENSION_FIXTURE);
	const imported = await import(path, {with: {type: 'json'}}); // import attribute means `.json` is not required
	expect(imported).toBeTruthy();
	expect(imported.default.some_test_json_without_extension).toBeTruthy();
	expect(imported.default).toEqual(JSON.parse(readFileSync(path, 'utf8')));
});

test('fail to import .json without the import attribute', async () => {
	let imported;
	let err;
	try {
		imported = await import(resolve(JSON_FIXTURE)); // intentionally missing the import attribute and expecting failure
	} catch (error) {
		err = error;
	}
	expect(err).toBeTruthy();
	expect(imported).toBeFalsy();
});

test('import raw .css', async () => {
	const path = resolve('src/fixtures/modules/some_test_css.css');
	const imported = await import(path);
	expect(typeof imported.default).toBe('string');
	expect(imported.default).toEqual(readFileSync(path, 'utf8'));
});

test('import .svelte', async () => {
	const imported = await import(resolve('src/fixtures/modules/Some_Test_Svelte.svelte'));
	expect(imported).toBeTruthy();
	expect(imported.a).toBe('ok');
});

test('import raw .svelte', async () => {
	const path = resolve('src/fixtures/modules/Some_Test_Svelte.svelte');
	const imported = await import(path + '?raw');
	expect(imported).toBeTruthy();
	expect(imported.default).toEqual(readFileSync(path, 'utf8'));
});

test('import .svelte.js', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_svelte_js.svelte.js'));
	expect(imported.Some_Test_Svelte_Js).toBeTruthy();
	const instance = new imported.Some_Test_Svelte_Js();
	expect(instance.a).toBe('ok');
});

test('import .svelte.ts', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_svelte_ts.svelte.ts'));
	expect(imported.Some_Test_Svelte_Ts).toBeTruthy();
	const instance = new imported.Some_Test_Svelte_Ts();
	expect(instance.a).toBe('ok');
});
