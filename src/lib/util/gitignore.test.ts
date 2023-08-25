import {resolve} from 'node:path';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {loadGitignoreFilter} from './gitignore.js';

/* test__loadGitignoreFilter */
const test__loadGitignoreFilter = suite('loadGitignoreFilter');

test__loadGitignoreFilter('basic behavior', () => {
	const filter = loadGitignoreFilter();
	assert.ok(filter(resolve('dist')));
	assert.ok(!filter(resolve('a/dist')));
	assert.ok(filter(resolve('node_modules')));
	assert.ok(filter(resolve('a/node_modules')));
	assert.ok(filter(resolve('node_modules/a')));
	assert.ok(filter(resolve('a/node_modules/b')));
	assert.ok(!filter(resolve('node_module')));
	assert.ok(!filter(resolve('a/node_module')));
	assert.ok(!filter(resolve('node_module/a')));
	assert.ok(!filter(resolve('a/node_module/b')));
});

test__loadGitignoreFilter('caching and forceRefresh', () => {
	const filter1 = loadGitignoreFilter();
	const filter2 = loadGitignoreFilter();
	assert.is(filter1, filter2);
	const filter3 = loadGitignoreFilter(true);
	assert.is.not(filter1, filter3);
	const filter4 = loadGitignoreFilter(false);
	assert.is(filter3, filter4);
	const filter5 = loadGitignoreFilter(true);
	assert.is.not(filter4, filter5);
});

test__loadGitignoreFilter.run();
/* test__loadGitignoreFilter */
