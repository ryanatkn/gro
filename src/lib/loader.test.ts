import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

test('import js', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.js'));
	assert.ok(imported);
});

test('import ts', async () => {
	const imported = await import(resolve('src/fixtures/modules/some_test_ts.ts'));
	assert.ok(imported);
});

test('import css', async () => {
	// const imported = await import(resolve('src/fixtures/modules/some_test_css.css'));
	// assert.ok(imported);
});

test('import svelte', async () => {
	const imported = await import(resolve('src/fixtures/modules/Some_Test_Svelte.svelte'));
	assert.ok(imported);
});

test.run();
