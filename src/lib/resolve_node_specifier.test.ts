import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {resolve_node_specifier} from './resolve_node_specifier.js';
import {paths} from './paths.js';

test('resolves a JS specifier', async () => {
	assert.is(
		await resolve_node_specifier('@ryanatkn/fuz/tome.js'),
		paths.root + 'node_modules/@ryanatkn/fuz/dist/tome.js',
	);
});

test('resolves a Svelte specifier', async () => {
	assert.is(
		await resolve_node_specifier('@ryanatkn/fuz/Library.svelte'),
		paths.root + 'node_modules/@ryanatkn/fuz/dist/Library.svelte',
	);
});

test('throws for a specifier that does not exist', async () => {
	let err;
	try {
		await resolve_node_specifier('@ryanatkn/fuz/this_does_not_exist');
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test.run();
