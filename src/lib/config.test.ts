import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {DEFAULT_SEARCH_EXCLUDER, load_config} from './config.js';

test('load_config', async () => {
	const config = await load_config();
	assert.ok(config);
});

test('DEFAULT_SEARCH_EXCLUDER', () => {
	const assert_includes = (path: string, exclude: boolean) => {
		const m = `should ${exclude ? 'exclude' : 'include '}: ${path}`;
		const b = (v: boolean) => (exclude ? !v : v);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/c`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/c/d.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/c/d.e.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`a/${path}`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/c`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/c/d.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/c/d.e.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/${path}/a`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/${path}/a/b.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/${path}/a/b.e.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/${path}/`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`/${path}`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`./${path}/a`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`./${path}/a/b.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`./${path}/a/b.c.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`./${path}/`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`./${path}`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`${path}/a`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`${path}/a/b.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`${path}/a/b.c.js`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(`${path}/`)), m);
		assert.ok(b(DEFAULT_SEARCH_EXCLUDER.test(path)), m);
	};

	assert_includes('node_modules', false);
	assert_includes('dist', false);
	assert_includes('build', false);
	assert_includes('.git', false);
	assert_includes('.gro', false);
	assert_includes('.svelte-kit', false);

	assert_includes('a', true);
	assert_includes('nodemodules', true);

	// Special exception for `gro/dist/`, but not `gro/build/` etc because they're not usecases.
	assert_includes('gro/build', false);
	assert_includes('gro/buildE', true);
	assert_includes('groE/build', false);
	assert_includes('gro/dist', true);
	assert_includes('gro/distE', true);
	assert_includes('groE/dist', false);
	assert_includes('not_gro/dist', false);
	assert_includes('not_dist', true); // TODO BLOCK these fail
	assert_includes('grodist', true); // TODO BLOCK these fail
});

test.run();
