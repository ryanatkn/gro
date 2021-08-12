import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {FsStats} from './filesystem.js';

/* test_FsStats */
const test_FsStats = suite('FsStats');

test_FsStats('basic behavior', async () => {
	const dir_stats = new FsStats(true);
	t.ok(dir_stats.isDirectory());
	const file_stats = new FsStats(false);
	t.ok(!file_stats.isDirectory());
});

test_FsStats.run();
/* /test_FsStats */
