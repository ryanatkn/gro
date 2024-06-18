import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {resolve_specifier} from './resolve_specifier.js';
import {paths} from './paths.js';

const dir = paths.source + 'fixtures/';

test('resolves a specifier to a file that exists with an unknown file extension', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_file.other.ext'), dir), {
		specifier: './test_file.other.ext',
		path_id: join(dir, 'test_file.other.ext'),
		namespace: undefined,
	});
});

test('resolves a ts specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts.ts'), dir), {
		specifier: './test_ts.js',
		path_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test('resolves relative ts specifiers', async () => {
	assert.equal(await resolve_specifier('./test_ts.ts', dir), {
		specifier: './test_ts.js',
		path_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
	assert.equal(await resolve_specifier('./a/b/test_ts.ts', dir), {
		specifier: './a/b/test_ts.js',
		path_id: join(dir, 'a/b/test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
	assert.equal(await resolve_specifier('../../test_ts.ts', dir), {
		specifier: '../../test_ts.js',
		path_id: join(dir, '../../test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test('resolves an extensionless specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts'), dir), {
		specifier: './test_ts.js',
		path_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test('resolves a js specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_js.js'), dir), {
		specifier: './test_js.js',
		path_id: join(dir, 'test_js.js'),
		namespace: 'sveltekit_local_imports_js',
	});
});

test('resolves a js specifier as ts for a file that does not exist', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_missing.js'), dir), {
		specifier: './test_missing.js',
		path_id: join(dir, 'test_missing.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test('resolves an extensionless specifier for a file that does not exist', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_missing'), dir), {
		specifier: './test_missing.js',
		path_id: join(dir, 'test_missing.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test.run();
