import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {fs as nodeFs} from './node.js';

/* test__findFiles */
const test__findFiles = suite('findFiles', {fs: nodeFs});

test__findFiles('basic behavior', async ({fs}) => {
	const ignoredPath = 'test1.foo.ts';
	let hasIgnoredPath = false;
	const result = await fs.findFiles(
		'./src/fs/fixtures',
		(path) => {
			if (!hasIgnoredPath) hasIgnoredPath = path === ignoredPath;
			return path !== ignoredPath;
		},
		(a, b) => -a[0].localeCompare(b[0]),
	);
	assert.ok(hasIgnoredPath); // makes sure the test isn't wrong
	assert.equal(Array.from(result.keys()), [
		'test2.foo.ts',
		'baz2/test2.baz.ts',
		'baz1/test1.baz.ts',
		'bar2/test2.bar.ts',
		'bar1/test1.bar.ts',
	]);
});

// TODO more tests

test__findFiles.run();
/* test__findFiles */
