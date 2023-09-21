import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {search_fs} from './search_fs.js';
import {paths} from './paths.js';

/* test__search_fs */
const test__search_fs = suite('search_fs');

test__search_fs('basic behavior', async () => {
	const ignoredPath = 'test1.foo.ts';
	let hasIgnoredPath = false;
	const result = await search_fs('./src/lib/fixtures', {
		filter: (path) => {
			if (!hasIgnoredPath) hasIgnoredPath = path.endsWith(ignoredPath);
			return !path.endsWith(ignoredPath);
		},
		sort: (a, b) => -a[0].localeCompare(b[0]),
	});
	assert.ok(hasIgnoredPath); // makes sure the test isn't wrong
	assert.equal(
		Array.from(result.keys()),
		[
			'test2.foo.ts',
			'test_ts.ts',
			'test_js.js',
			'test_file.other.ext',
			'baz2/test2.baz.ts',
			'baz1/test1.baz.ts',
			'bar2/test2.bar.ts',
			'bar1/test1.bar.ts',
		].map((f) => paths.lib + 'fixtures/' + f),
	);
});

// TODO more tests

test__search_fs.run();
/* test__search_fs */
