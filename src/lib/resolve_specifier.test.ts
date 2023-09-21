import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {resolve_specifier} from './resolve_specifier.js';
import {paths} from './paths.js';
import {join} from 'node:path';

/* test__resolve_specifier */
const test__resolve_specifier = suite('resolve_specifier');

const dir = paths.lib + 'fixtures/';

test__resolve_specifier(
	'resolves a specifier to a file that exists with an unknown file extension',
	async () => {
		assert.equal(await resolve_specifier(join(dir, 'test_file.other.ext'), dir), {
			specifier: './test_file.other.ext',
			source_id: join(dir, 'test_file.other.ext'),
			namespace: undefined,
		});
	},
);

test__resolve_specifier('resolves a ts specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts.ts'), dir), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves relative ts specifiers', async () => {
	assert.equal(await resolve_specifier('./test_ts.ts', dir), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
	assert.equal(await resolve_specifier('./a/b/test_ts.ts', dir), {
		specifier: './a/b/test_ts.js',
		source_id: join(dir, 'a/b/test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
	assert.equal(await resolve_specifier('../../test_ts.ts', dir), {
		specifier: '../../test_ts.js',
		source_id: join(dir, '../../test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves an extensionless specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts'), dir), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a js specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_js.js'), dir), {
		specifier: './test_js.js',
		source_id: join(dir, 'test_js.js'),
		namespace: 'sveltekit_local_imports_js',
	});
});

test__resolve_specifier(
	'resolves a js specifier as ts for a file that does not exist',
	async () => {
		assert.equal(await resolve_specifier(join(dir, 'test_missing.js'), dir), {
			specifier: './test_missing.js',
			source_id: join(dir, 'test_missing.ts'),
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__resolve_specifier(
	'resolves an extensionless specifier for a file that does not exist',
	async () => {
		assert.equal(await resolve_specifier(join(dir, 'test_missing'), dir), {
			specifier: './test_missing.js',
			source_id: join(dir, 'test_missing.ts'),
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__resolve_specifier.run();
/* resolve_specifier_result */
