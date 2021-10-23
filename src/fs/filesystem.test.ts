import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {FsStats} from './filesystem.js';

/* test__FsStats */
const test__FsStats = suite('FsStats');

test__FsStats('basic behavior', async () => {
	const dirStats = new FsStats(true);
	assert.ok(dirStats.isDirectory());
	const fileStats = new FsStats(false);
	assert.ok(!fileStats.isDirectory());
});

test__FsStats.run();
/* test__FsStats */
