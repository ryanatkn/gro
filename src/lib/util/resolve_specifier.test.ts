import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {resolve_specifier} from './resolve_specifier.js';
import {paths} from './paths.js';
import {join} from 'node:path';

/* test__resolve_specifier */
const test__resolve_specifier = suite('resolve_specifier');

const dir = paths.lib + 'util/fixtures/';

test__resolve_specifier('resolves a ts specifier', async () => {
	assert.equal(await resolve_specifier(dir + 'test_ts.ts', dir + 'importer.ts', dir), {
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves an extensionless specifier', async () => {
	assert.equal(await resolve_specifier(dir + 'test_ts', dir + 'importer.ts', dir), {
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a js specifier', async () => {
	assert.equal(await resolve_specifier(dir + 'test_js.js', dir + 'importer.ts', dir), {
		specifier: './test_js.js',
		source_id: dir + 'test_js.js',
		namespace: 'sveltekit_local_imports_js',
	});
});

test__resolve_specifier(
	'resolves a js specifier as ts for a file that does not exist',
	async () => {
		assert.equal(await resolve_specifier(dir + 'test_missing.js', dir + 'importer.ts', dir), {
			specifier: './test_missing.js',
			source_id: dir + 'test_missing.ts',
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__resolve_specifier(
	'resolves an extensionless specifier for a file that does not exist',
	async () => {
		assert.equal(await resolve_specifier(dir + 'test_missing', dir + 'importer.ts', dir), {
			specifier: './test_missing.js',
			source_id: dir + 'test_missing.ts',
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__resolve_specifier('resolves from a directory 1 deeper', async () => {
	assert.equal(await resolve_specifier(dir + 'test_ts.ts', dir + '/a/importer.ts', dir), {
		specifier: '../test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves from a directory 2 deeper', async () => {
	assert.equal(await resolve_specifier(dir + 'test_ts.ts', dir + '/a/b/importer.ts', dir), {
		specifier: '../../test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves from a directory 1 shallower', async () => {
	assert.equal(await resolve_specifier(dir + 'test_ts.ts', join(dir + '../importer.ts'), dir), {
		specifier: './fixtures/test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves from a directory 2 shallower', async () => {
	assert.equal(await resolve_specifier(dir + 'test_ts.ts', join(dir + '../../importer.ts'), dir), {
		specifier: './util/fixtures/test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a relative ts specifier', async () => {
	assert.equal(await resolve_specifier('./test_ts.ts', dir + 'importer.ts', dir), {
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a relative ts specifier 2 deeper', async () => {
	assert.equal(await resolve_specifier('./a/b/test_ts.ts', dir + 'importer.ts', dir), {
		specifier: './a/b/test_ts.js',
		source_id: dir + 'a/b/test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a relative ts specifier 2 shallower', async () => {
	assert.equal(await resolve_specifier('../../test_ts.ts', dir + 'importer.ts', dir), {
		specifier: '../../test_ts.js',
		source_id: join(dir, '../../test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a ts specifier with a relative importer', async () => {
	assert.equal(await resolve_specifier(dir + 'test_ts.ts', './importer.ts', dir), {
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a ts specifier with a relative importer 2 deeper', async () => {
	assert.equal(await resolve_specifier('./a/b/test_ts.ts', dir + 'importer.ts', dir), {
		specifier: './a/b/test_ts.js',
		source_id: dir + 'a/b/test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier(
	'resolves a ts specifier with a relative importer 2 shallower',
	async () => {
		assert.equal(await resolve_specifier('../../test_ts.ts', dir + 'importer.ts', dir), {
			specifier: '../../test_ts.js',
			source_id: join(dir, '../../test_ts.ts'),
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__resolve_specifier.run();
/* resolve_specifier_result */
