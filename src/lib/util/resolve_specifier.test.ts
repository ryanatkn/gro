import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {resolve_specifier} from './resolve_specifier.js';
import {paths} from './paths.js';
import {join} from 'node:path';

/* test__resolve_specifier */
const test__resolve_specifier = suite('resolve_specifier');

const dir = paths.lib + 'util/fixtures/';

test__resolve_specifier('resolves a ts specifier without a directory', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts.ts'), join(dir, 'importer.ts')), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier(
	'resolves a ts specifier with a relative specifier and without a directory',
	async () => {
		assert.equal(await resolve_specifier('./test_ts.ts', join(dir, 'importer.ts')), {
			specifier: './test_ts.js',
			source_id: join(dir, 'test_ts.ts'),
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__resolve_specifier('resolves a ts specifier from a relative importer', async () => {
	assert.equal(
		await resolve_specifier(join(dir, 'a/b/test_ts.ts'), '../../importer.ts', join(dir, 'a', 'b')),
		{
			specifier: './a/b/test_ts.js',
			source_id: join(dir, 'a/b/test_ts.ts'),
			namespace: 'sveltekit_local_imports_ts',
		},
	);
});

test__resolve_specifier.only('resolves a relative ts specifier from a relative importer', async () => {
	assert.equal(await resolve_specifier('./test_ts.ts', '../../importer.ts', join(dir, 'a', 'b')), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves an extensionless specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts'), join(dir, 'importer.ts'), dir), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a js specifier', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_js.js'), join(dir, 'importer.ts'), dir), {
		specifier: './test_js.js',
		source_id: join(dir, 'test_js.js'),
		namespace: 'sveltekit_local_imports_js',
	});
});

test__resolve_specifier(
	'resolves a js specifier as ts for a file that does not exist',
	async () => {
		assert.equal(
			await resolve_specifier(join(dir, 'test_missing.js'), join(dir, 'importer.ts'), dir),
			{
				specifier: './test_missing.js',
				source_id: join(dir, 'test_missing.ts'),
				namespace: 'sveltekit_local_imports_ts',
			},
		);
	},
);

test__resolve_specifier(
	'resolves an extensionless specifier for a file that does not exist',
	async () => {
		assert.equal(
			await resolve_specifier(join(dir, 'test_missing'), join(dir, 'importer.ts'), dir),
			{
				specifier: './test_missing.js',
				source_id: join(dir, 'test_missing.ts'),
				namespace: 'sveltekit_local_imports_ts',
			},
		);
	},
);

test__resolve_specifier('resolves from a directory 1 deeper', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts.ts'), join(dir, '/a/importer.ts'), dir), {
		specifier: '../test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves from a directory 2 deeper', async () => {
	assert.equal(
		await resolve_specifier(join(dir, 'test_ts.ts'), join(dir, '/a/b/importer.ts'), dir),
		{
			specifier: '../../test_ts.js',
			source_id: join(dir, 'test_ts.ts'),
			namespace: 'sveltekit_local_imports_ts',
		},
	);
});

test__resolve_specifier('resolves from a directory 1 shallower', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts.ts'), join(dir, '../importer.ts'), dir), {
		specifier: './fixtures/test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves from a directory 2 shallower', async () => {
	assert.equal(
		await resolve_specifier(join(dir, 'test_ts.ts'), join(dir, '../../importer.ts'), dir),
		{
			specifier: './util/fixtures/test_ts.js',
			source_id: join(dir, 'test_ts.ts'),
			namespace: 'sveltekit_local_imports_ts',
		},
	);
});

test__resolve_specifier('resolves a relative ts specifier', async () => {
	assert.equal(await resolve_specifier('./test_ts.ts', join(dir, 'importer.ts'), dir), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a relative ts specifier 2 deeper', async () => {
	assert.equal(await resolve_specifier('./a/b/test_ts.ts', join(dir, 'importer.ts'), dir), {
		specifier: './a/b/test_ts.js',
		source_id: join(dir, 'a/b/test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a relative ts specifier 2 shallower', async () => {
	assert.equal(await resolve_specifier('../../test_ts.ts', join(dir, 'importer.ts'), dir), {
		specifier: '../../test_ts.js',
		source_id: join(dir, '../../test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a ts specifier with a relative importer', async () => {
	assert.equal(await resolve_specifier(join(dir, 'test_ts.ts'), './importer.ts', dir), {
		specifier: './test_ts.js',
		source_id: join(dir, 'test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier('resolves a ts specifier with a relative importer 2 deeper', async () => {
	assert.equal(await resolve_specifier('./a/b/test_ts.ts', join(dir, 'importer.ts'), dir), {
		specifier: './a/b/test_ts.js',
		source_id: join(dir, 'a/b/test_ts.ts'),
		namespace: 'sveltekit_local_imports_ts',
	});
});

test__resolve_specifier(
	'resolves a ts specifier with a relative importer 2 shallower',
	async () => {
		assert.equal(await resolve_specifier('../../test_ts.ts', join(dir, 'importer.ts'), dir), {
			specifier: '../../test_ts.js',
			source_id: join(dir, '../../test_ts.ts'),
			namespace: 'sveltekit_local_imports_ts',
		});
	},
);

test__resolve_specifier(
	'fails to resolve a specifier with a relative importer and without a directory',
	async () => {
		let err;
		try {
			await resolve_specifier('./test_ts.ts', './importer.ts', dir);
		} catch (_err) {
			err = _err;
		}
		assert.ok(err);
	},
);

test__resolve_specifier.run();
/* resolve_specifier_result */
