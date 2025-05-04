import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {SEARCH_EXCLUDER_DEFAULT, load_gro_config} from './gro_config.ts';

test('load_gro_config', async () => {
	const config = await load_gro_config();
	assert.ok(config);
});

test('SEARCH_EXCLUDER_DEFAULT', () => {
	const assert_includes = (path: string, exclude: boolean) => {
		const m = `should ${exclude ? 'exclude' : 'include '}: ${path}`;
		const b = (v: boolean) => (exclude ? !v : v);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`a/${path}/c`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`a/${path}/c/d.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`a/${path}/c/d.e.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`a/${path}/`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`a/${path}`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/a/${path}/c`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/a/${path}/c/d.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/a/${path}/c/d.e.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/a/${path}/`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/a/${path}`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/${path}/a`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/${path}/a/b.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/${path}/a/b.e.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/${path}/`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`/${path}`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`./${path}/a`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`./${path}/a/b.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`./${path}/a/b.c.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`./${path}/`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`./${path}`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`${path}/a`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`${path}/a/b.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`${path}/a/b.c.js`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(`${path}/`)), m);
		assert.ok(b(SEARCH_EXCLUDER_DEFAULT.test(path)), m);
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
	assert_includes('node_modules/gro/dist', true);
	assert_includes('node_modules/@someuser/gro/dist', true);
	assert_includes('node_modules/@someuser/foo/gro/dist', false);
	assert_includes('gro/distE', true);
	assert_includes('groE/dist', false);
	assert_includes('Egro/dist', false);
	assert_includes('Ebuild', true);
	assert_includes('buildE', true);
	assert_includes('grobuild', true);
	assert_includes('distE', true);
	assert_includes('Edist', true);
	assert_includes('grodist', true);
});

test.run();
