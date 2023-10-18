import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {resolve_node_specifier} from './resolve_node_specifier.js';
import {paths} from './paths.js';

test('resolves a JS specifier', async () => {
	assert.is(
		await resolve_node_specifier('@fuz.dev/fuz_library/tome.js'),
		paths.root + 'node_modules/@fuz.dev/fuz_library/dist/tome.js',
	);
});

test('resolves a Svelte specifier', async () => {
	assert.is(
		await resolve_node_specifier('@fuz.dev/fuz_library/Library.svelte'),
		paths.root + 'node_modules/@fuz.dev/fuz_library/dist/Library.svelte',
	);
});

test('resolves a Svelte specifier', async () => {
	let err;
	try {
		await resolve_node_specifier('@fuz.dev/fuz_library/this_does_not_exist');
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test.run();
