import {resolve} from 'path';
import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {load_gitignore_filter} from './gitignore.js';

/* test_load_gitignore_filter */
const test_load_gitignore_filter = suite('load_gitignore_filter');

test_load_gitignore_filter('basic behavior', () => {
	const filter = load_gitignore_filter();
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

test_load_gitignore_filter('caching and force_refresh', () => {
	const filter1 = load_gitignore_filter();
	const filter2 = load_gitignore_filter();
	t.is(filter1, filter2);
	const filter3 = load_gitignore_filter(true);
	t.is.not(filter1, filter3);
	const filter4 = load_gitignore_filter(false);
	t.is(filter3, filter4);
	const filter5 = load_gitignore_filter(true);
	t.is.not(filter4, filter5);
});

test_load_gitignore_filter.run();
/* /test_load_gitignore_filter */
