import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {fs as node_fs} from './node.js';

/* test_find_files */
const test_find_files = suite('find_files', {fs: node_fs});

test_find_files('basic behavior', async ({fs}) => {
	const ignoredPath = 'test1.foo.ts';
	let hasIgnoredPath = false;
	const result = await fs.find_files(
		'./src/fs/fixtures',
		({path}) => {
			if (!hasIgnoredPath) hasIgnoredPath = path === ignoredPath;
			return path !== ignoredPath;
		},
		(a, b) => -a[0].localeCompare(b[0]),
	);
	t.ok(hasIgnoredPath); // makes sure the test isn't wrong
	t.equal(Array.from(result.keys()), [
		'test2.foo.ts',
		'baz2/test2.baz.ts',
		'baz2',
		'baz1/test1.baz.ts',
		'baz1',
		'bar2/test2.bar.ts',
		'bar2',
		'bar1/test1.bar.ts',
		'bar1',
	]);
});

// TODO more tests

test_find_files.run();
/* /test_find_files */
