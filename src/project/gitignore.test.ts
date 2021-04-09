import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {isIgnored} from './gitignore.js';

/* test_isIgnored */
const test_isIgnored = suite('isIgnored');

test_isIgnored('basic behavior', () => {
	t.ok(isIgnored('node_modules'));
	t.ok(!isIgnored('node_module'));
	// TODO ignore other patterns too, but this is sufficient for now
	// t.ok(isIgnored('node_modules/a/b'));
	// t.ok(isIgnored('a/b/node_modules/c/d'));
	// t.ok(isIgnored('/a/b/node_modules/c/d'));
});

test_isIgnored.run();
/* /test_isIgnored */
