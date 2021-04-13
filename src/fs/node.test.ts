import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {fs as nodeFs} from './node.js';

/* test_findFiles */
const test_findFiles = suite('findFiles', {fs: nodeFs});

test_findFiles('basic behavior', async ({fs}) => {
	const ignoredPath = 'test1.foo.ts';
	let hasIgnoredPath = false;
	const result = await fs.findFiles(
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

test_findFiles.run();
/* /test_findFiles */
