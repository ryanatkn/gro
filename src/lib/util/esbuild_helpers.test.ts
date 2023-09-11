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
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses an extensionless specifier', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts', dir + 'importer.ts'), {
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a js specifier', async () => {
	assert.equal(await parse_specifier(dir + 'test_js.js', dir + 'importer.ts'), {
		specifier: './test_js.js',
		source_id: dir + 'test_js.js',
		namespace: 'sveltekit_local_imports_js',
	});
});

test__parse_specifier('parses a js specifier as ts for a file that does not exist', async () => {
	assert.equal(await parse_specifier(dir + 'test_missing.js', dir + 'importer.ts'), {
		specifier: './test_missing.js',
		source_id: dir + 'test_missing.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier(
	'parses an extensionless specifier for a file that does not exist',
	async () => {
		assert.equal(await parse_specifier(dir + 'test_missing', dir + 'importer.ts'), {
			specifier: './test_missing.js',
			source_id: dir + 'test_missing.ts',
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__parse_specifier('parses from a directory 1 deeper', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', dir + '/a/importer.ts'), {
		specifier: '../test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses from a directory 2 deeper', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', dir + '/a/b/importer.ts'), {
		specifier: '../../test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses from a directory 1 shallower', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', join(dir + '../importer.ts')), {
		specifier: './fixtures/test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses from a directory 2 shallower', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', join(dir + '../../importer.ts')), {
		specifier: './util/fixtures/test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a relative ts specifier', async () => {
	assert.equal(await parse_specifier('./test_ts.ts', dir + 'importer.ts'), {
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a relative ts specifier 2 deeper', async () => {
	assert.equal(await parse_specifier('./a/b/test_ts.ts', dir + 'importer.ts'), {
		specifier: './a/b/test_ts.js',
		source_id: dir + 'a/b/test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a relative ts specifier 2 shallower', async () => {
	assert.equal(await parse_specifier('../../test_ts.ts', dir + 'importer.ts'), {
		specifier: '../../test_ts.js',
		source_id: join(dir, '../../test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a ts specifier with a relative importer', async () => {
	assert.equal(await parse_specifier(dir + 'test_ts.ts', './importer.ts'), {
		specifier: './test_ts.js',
		source_id: dir + 'test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a ts specifier with a relative importer 2 deeper', async () => {
	assert.equal(await parse_specifier('./a/b/test_ts.ts', dir + 'importer.ts'), {
		specifier: './a/b/test_ts.js',
		source_id: dir + 'a/b/test_ts.ts',
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier('parses a ts specifier with a relative importer 2 shallower', async () => {
	assert.equal(await parse_specifier('../../test_ts.ts', dir + 'importer.ts'), {
		specifier: '../../test_ts.js',
		source_id: join(dir, '../../test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__parse_specifier(
	'fails to parse when the specifier and importer are both relative',
	async () => {
		let err;
		try {
			await parse_specifier('./test_ts.ts', './importer.ts');
		} catch (_err) {
			err = _err;
		}
		assert.ok(err, 'expected an error');
	},
);

test__parse_specifier.run();
/* parse_specifier_result */
