import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {isGitignored, loadGitignoreFilter} from './gitignore.js';

/* test_isGitignored */
const test_isGitignored = suite('isGitignored');

test_isGitignored('basic behavior', () => {
	t.ok(isGitignored('node_modules'));
	t.ok(!isGitignored('node_module'));
	// TODO ignore other patterns too, but this is sufficient for now
	// t.ok(isGitignored('node_modules/a/b'));
	// t.ok(isGitignored('a/b/node_modules/c/d'));
	// t.ok(isGitignored('/a/b/node_modules/c/d'));
});

test_isGitignored.run();
/* /test_isGitignored */

/* test_loadGitignoreFilter */
const test_loadGitignoreFilter = suite('loadGitignoreFilter');

test_loadGitignoreFilter('basic behavior', () => {
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
