import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {load_module} from './modules.ts';

// TODO if we import directly, svelte-package generates types in `src/fixtures`
/* eslint-disable no-useless-concat */
const mod_test1 = await import('../fixtures/' + 'test1.foo.js');

test('load_module basic behavior', async () => {
	const id = resolve('src/fixtures/test1.foo.js');
	let validated_mod;
	const result = await load_module(id, (mod): mod is any => {
		validated_mod = mod;
		return true;
	});
	assert.ok(result.ok);
	assert.is(result.id, id);
	assert.is(result.mod, validated_mod);
	assert.is(result.mod, mod_test1);
});

test('load_module without validation', async () => {
	const id = resolve('src/fixtures/test1.foo.js');
	const result = await load_module(id);
	assert.ok(result.ok);
	assert.is(result.id, id);
	assert.is(result.mod, mod_test1);
});

test('load_module fails validation', async () => {
	const id = resolve('src/fixtures/test1.foo.js');
	let validated_mod;
	const test_validation = (mod: Record<string, any>) => {
		validated_mod = mod;
		return false;
	};
	const result = await load_module(id, test_validation as any);
	assert.ok(!result.ok);
	if (result.type === 'failed_validation') {
		assert.is(result.validation, test_validation.name);
		assert.is(result.id, id);
		assert.is(result.mod, validated_mod);
		assert.is(result.mod, mod_test1);
	} else {
		throw Error('Should be invalid');
	}
});

test('load_module fails to import', async () => {
	const id = resolve('foo/test/failure');
	const result = await load_module(id);
	assert.ok(!result.ok);
	if (result.type === 'failed_import') {
		assert.is(result.id, id);
		assert.ok(result.error instanceof Error);
	} else {
		throw Error('Should fail to import');
	}
});

test.run();
