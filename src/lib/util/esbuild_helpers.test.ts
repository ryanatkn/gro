import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {parse_specifier} from './esbuild_helpers.js';
import {paths} from '../path/paths.js';
import {join} from 'node:path';

/* test__parse_specifier */
const test__parse_specifier = suite('parse_specifier');

const dir = paths.lib + 'util/fixtures/';

test__parse_specifier('parses a ts specifier', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', dir + 'importer.ts'), {
		final_path: './test_ts.js',
		source_path: dir + 'test_ts.ts',
		mapped_path: dir + 'test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a specifier without a file extension', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts', dir + 'importer.ts'), {
		final_path: './test_ts.js',
		source_path: dir + 'test_ts.ts',
		mapped_path: dir + 'test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a js specifier', async () => {
	assert.equal(await parse_specifier(dir + 'test_js.js', dir + 'importer.ts'), {
		final_path: './test_js.js',
		source_path: dir + 'test_js.js',
		mapped_path: dir + 'test_js.js',
		namespace: 'sveltekit_local_imports_js',
	});
});

test__parse_specifier('parses from a directory 1 deeper', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', dir + '/a/importer.ts'), {
		final_path: '../test_ts.js',
		source_path: dir + 'test_ts.ts',
		mapped_path: dir + 'test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses from a directory 2 deeper', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', dir + '/a/b/importer.ts'), {
		final_path: '../../test_ts.js',
		source_path: dir + 'test_ts.ts',
		mapped_path: dir + 'test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses from a directory 1 shallower', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', join(dir + '../importer.ts')), {
		final_path: './fixtures/test_ts.js',
		source_path: dir + 'test_ts.ts',
		mapped_path: dir + 'test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses from a directory 2 shallower', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', join(dir + '../../importer.ts')), {
		final_path: './util/fixtures/test_ts.js',
		source_path: dir + 'test_ts.ts',
		mapped_path: dir + 'test_ts.js',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier.run();
/* parse_specifier_result */
