import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {resolve_node_specifier} from './resolve_node_specifier.js';

test('resolves a Node specifier', () => {
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

test('resolves a Node specifier with a username', () => {
	const specifier = '@sveltejs/kit';
	const path_id = resolve('node_modules/@sveltejs/kit/src/exports/index.js');
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

test('throws for an export that does not exist', () => {
	assert.throws(() => resolve_node_specifier('@ryanatkn/fuz/this_export_does_not_exist'));
});

test('throws for a package that does not exist', () => {
	assert.throws(() => resolve_node_specifier('@ryanatkn/this_package_does_not_exist'));
});

test('throws for a Node specifier', () => {
	assert.throws(() => resolve_node_specifier('node:path'));
});

test('optionally returns null for an export that does not exist', () => {
	assert.is(
		resolve_node_specifier(
			'@ryanatkn/fuz/this_export_does_not_exist',
			undefined,
			undefined,
			undefined,
			false,
		),
		null,
	);
});

test('optionally returns null for a package that does not exist', () => {
	assert.is(
		resolve_node_specifier(
			'@ryanatkn/this_package_does_not_exist',
			undefined,
			undefined,
			undefined,
			false,
		),
		null,
	);
});

test('optionally returns null for a Node specifier', () => {
	assert.is(resolve_node_specifier('node:path', undefined, undefined, undefined, false), null);
});

test.run();
