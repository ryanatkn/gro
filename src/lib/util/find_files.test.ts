import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {find_files} from './find_files.js';
import {paths} from '../path/paths.js';

/* test__find_files */
const test__find_files = suite('find_files');

test__find_files('basic behavior', async () => {
	const ignoredPath = 'test1.foo.ts';
	let hasIgnoredPath = false;
	const result = await find_files(
		'./src/lib/util/fixtures',
		(path) => {
			if (!hasIgnoredPath) hasIgnoredPath = path.endsWith(ignoredPath);
			return !path.endsWith(ignoredPath);
		},
		(a, b) => -a[0].localeCompare(b[0]),
		true,
	);
	assert.ok(hasIgnoredPath); // makes sure the test isn't wrong
	assert.equal(
		Array.from(result.keys()),
		[
			'test2.foo.ts',
			'baz2/test2.baz.ts',
			'baz1/test1.baz.ts',
			'bar2/test2.bar.ts',
			'bar1/test1.bar.ts',
		].map((f) => paths.lib + 'util/fixtures/' + f),
	);
});

// TODO more tests

test__find_files.run();
/* test__find_files */
