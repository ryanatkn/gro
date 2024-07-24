import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {resolve_node_specifier} from './resolve_node_specifier.js';

test('resolves a JS specifier', () => {
	const specifier = '@ryanatkn/fuz/tome.js';
	assert.equal(resolve_node_specifier(specifier), {
		path_id: resolve('node_modules/@ryanatkn/fuz/dist/tome.js'),
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
		raw: false,
	});
});

test('resolves a raw JS specifier', () => {
	const specifier = '@ryanatkn/fuz/tome.js?raw';
	assert.equal(resolve_node_specifier(specifier), {
		path_id: resolve('node_modules/@ryanatkn/fuz/dist/tome.js'),
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
		raw: true,
	});
});

test('resolves a Svelte specifier', () => {
	const specifier = '@ryanatkn/fuz/Library.svelte';
	assert.equal(resolve_node_specifier(specifier), {
		path_id: resolve('node_modules/@ryanatkn/fuz/dist/Library.svelte'),
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
		raw: false,
	});
});

test('throws for a specifier that does not exist', () => {
	let err;
	try {
		resolve_node_specifier('@ryanatkn/fuz/this_does_not_exist');
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test.run();
