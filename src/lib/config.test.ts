import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {DEFAULT_SEARCH_EXCLUDER, load_config} from './config.js';

test('load_config', async () => {
	const config = await load_config();
	assert.ok(config);
});

test('DEFAULT_SEARCH_EXCLUDER', () => {
	const assert_includes = (path: string, exclude: boolean) => {
		const msg = 'should include: ' + path;
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/c`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/c/d.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/c/d.e.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`a/${path}/`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`a/${path}`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/c`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/c/d.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/c/d.e.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}/`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/a/${path}`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/${path}/a`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/${path}/a/b.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/${path}/a/b.e.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/${path}/`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`/${path}`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`./${path}/a`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`./${path}/a/b.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`./${path}/a/b.c.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`./${path}/`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`./${path}`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`${path}/a`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`${path}/a/b.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`${path}/a/b.c.js`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(`${path}/`), msg);
		assert.ok(!DEFAULT_SEARCH_EXCLUDER.test(path), msg);
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
	assert_includes('groE/dist', true);
	assert_includes('not_gro/dist', true);
	assert_includes('not_dist', true);
	assert_includes('grodist', true);
});

test.run();
