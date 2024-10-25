import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {resolve_node_specifier} from './resolve_node_specifier.js';

test.only('resolves a root specifier', () => {
	const specifier = 'svelte';
	const path_id = resolve('node_modules/svelte/src/index-server.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test.only('resolves a root specifier with a username', () => {
	const specifier = '@sveltejs/kit';
	const path_id = resolve('node_modules/svelte/src/exports/index.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test('resolves a JS specifier', () => {
	const specifier = '@ryanatkn/fuz/tome.js';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/tome.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test('resolves a raw JS specifier', () => {
	const path = '@ryanatkn/fuz/tome.js';
	const specifier = path + '?raw';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/tome.js');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id + '?raw',
		raw: true,
		specifier,
		mapped_specifier: path,
		namespace: undefined,
	});
});

test('resolves a Svelte specifier', () => {
	const specifier = '@ryanatkn/fuz/Library.svelte';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/Library.svelte');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id,
		raw: false,
		specifier,
		mapped_specifier: specifier,
		namespace: undefined,
	});
});

test('resolves a raw Svelte specifier', () => {
	const path = '@ryanatkn/fuz/Library.svelte';
	const specifier = path + '?raw';
	const path_id = resolve('node_modules/@ryanatkn/fuz/dist/Library.svelte');
	assert.equal(resolve_node_specifier(specifier), {
		path_id,
		path_id_with_querystring: path_id + '?raw',
		raw: true,
		specifier,
		mapped_specifier: path,
		namespace: undefined,
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
