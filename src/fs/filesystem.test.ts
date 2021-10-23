import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {FsStats} from './filesystem.js';

/* test_FsStats */
const test_FsStats = suite('FsStats');

test_FsStats('basic behavior', async () => {
	const dirStats = new FsStats(true);
	assert.ok(dirStats.isDirectory());
	const fileStats = new FsStats(false);
	assert.ok(!fileStats.isDirectory());
});

test_FsStats.run();
/* /test_FsStats */
