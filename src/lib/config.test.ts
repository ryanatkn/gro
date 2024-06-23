import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {DEFAULT_SEARCH_EXCLUDER, load_config} from './config.js';

test('load_config', async () => {
	const config = await load_config();
	assert.ok(config);
});

test('DEFAULT_SEARCH_EXCLUDER', () => {
	console.log(`DEFAULT_SEARCH_EXCLUDER`, DEFAULT_SEARCH_EXCLUDER);
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('a/node_modules/c/d'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('a/node_modules/c'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('a/node_modules/'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('a/node_modules'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/a/node_modules/c/d'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/a/node_modules/c'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/a/node_modules/'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/a/node_modules'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/node_modules/a/b'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/node_modules/a'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/node_modules/'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('/node_modules'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('node_modules/a/b'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('node_modules/a'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('node_modules/'));
	assert.ok(DEFAULT_SEARCH_EXCLUDER.test('node_modules'));
	assert.ok(!DEFAULT_SEARCH_EXCLUDER.test('nodemodules'));
});

test.run();
