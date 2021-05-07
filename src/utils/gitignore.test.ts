import {resolve} from 'path';
import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {loadGitignoreFilter} from './gitignore.js';

/* test_loadGitignoreFilter */
const test_loadGitignoreFilter = suite('loadGitignoreFilter');

test_loadGitignoreFilter('basic behavior', () => {
	const filter = loadGitignoreFilter();
	t.ok(filter(resolve('dist')));
	t.ok(!filter(resolve('a/dist')));
	t.ok(filter(resolve('node_modules')));
	t.ok(filter(resolve('a/node_modules')));
	t.ok(filter(resolve('node_modules/a')));
	t.ok(filter(resolve('a/node_modules/b')));
	t.ok(!filter(resolve('node_module')));
	t.ok(!filter(resolve('a/node_module')));
	t.ok(!filter(resolve('node_module/a')));
	t.ok(!filter(resolve('a/node_module/b')));
});

test_loadGitignoreFilter('caching and forceRefresh', () => {
	const filter1 = loadGitignoreFilter();
	const filter2 = loadGitignoreFilter();
	t.is(filter1, filter2);
	const filter3 = loadGitignoreFilter(true);
	t.is.not(filter1, filter3);
	const filter4 = loadGitignoreFilter(false);
	t.is(filter3, filter4);
	const filter5 = loadGitignoreFilter(true);
	t.is.not(filter4, filter5);
});

test_loadGitignoreFilter.run();
/* /test_loadGitignoreFilter */
