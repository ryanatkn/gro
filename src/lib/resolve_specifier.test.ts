import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {resolve_specifier} from './resolve_specifier.js';
import {paths} from './paths.js';

const dir = paths.source + 'fixtures/';

test('resolves a specifier to a file that exists with an unknown file extension', () => {
	const specifier = join(dir, 'test_file.other.ext');
	assert.equal(resolve_specifier(specifier, dir), {
		path_id: specifier,
		specifier,
		mapped_specifier: './test_file.other.ext',
		namespace: undefined,
		raw: false,
	});
});

test('resolves a TS specifier', () => {
	const specifier = join(dir, 'test_ts.ts');
	assert.equal(resolve_specifier(specifier, dir), {
		path_id: specifier,
		specifier,
		mapped_specifier: './test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: false,
	});
});

test.only('resolves a `?raw` ts specifier', () => {
	const path = join(dir, 'test_ts.ts');
	const specifier = path + '?raw';
	assert.equal(resolve_specifier(specifier, dir), {
		path_id: path,
		specifier,
		mapped_specifier: './test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: true,
	});
});

test('resolves relative ts specifiers', () => {
	assert.equal(resolve_specifier('./test_ts.ts', dir), {
		path_id: join(dir, 'test_ts.ts'),
		specifier: './test_ts.ts',
		mapped_specifier: './test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: false,
	});
	assert.equal(resolve_specifier('./a/b/test_ts.ts', dir), {
		path_id: join(dir, 'a/b/test_ts.ts'),
		specifier: './a/b/test_ts.ts',
		mapped_specifier: './a/b/test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: false,
	});
	assert.equal(resolve_specifier('../../test_ts.ts', dir), {
		path_id: join(dir, '../../test_ts.ts'),
		specifier: '../../test_ts.ts',
		mapped_specifier: '../../test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: false,
	});
	assert.equal(resolve_specifier('../../test_ts.ts?raw', dir), {
		path_id: join(dir, '../../test_ts.ts'),
		specifier: '../../test_ts.ts?raw',
		mapped_specifier: '../../test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: true,
	});
});

test('resolves an extensionless specifier', () => {
	const specifier = join(dir, 'test_ts');
	assert.equal(resolve_specifier(specifier, dir), {
		path_id: specifier + '.ts',
		specifier,
		mapped_specifier: './test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: false,
	});
});

test('resolves a js specifier', () => {
	const specifier = join(dir, 'test_js.js');
	assert.equal(resolve_specifier(specifier, dir), {
		path_id: specifier,
		specifier,
		mapped_specifier: './test_js.js',
		namespace: 'sveltekit_local_imports_js',
		raw: false,
	});
});

test('resolves a js specifier as ts for a file that does not exist', () => {
	const specifier = join(dir, 'test_missing.js');
	assert.equal(resolve_specifier(specifier, dir), {
		path_id: join(dir, 'test_missing.ts'),
		specifier,
		mapped_specifier: './test_missing.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: false,
	});
});

test('resolves an extensionless specifier for a file that does not exist', () => {
	const specifier = join(dir, 'test_missing');
	assert.equal(resolve_specifier(specifier, dir), {
		path_id: specifier + '.ts',
		specifier,
		mapped_specifier: './test_missing.js',
		namespace: 'sveltekit_local_imports_ts',
		raw: false,
	});
});

test.run();
