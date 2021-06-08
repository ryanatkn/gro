import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {Fs_Stats} from './filesystem.js';

/* test_Fs_Stats */
const test_Fs_Stats = suite('Fs_Stats');

test_Fs_Stats('basic behavior', async () => {
	const dir_stats = new Fs_Stats(true);
	t.ok(dir_stats.isDirectory());
	const file_stats = new Fs_Stats(false);
	t.ok(!file_stats.isDirectory());
});

test_Fs_Stats.run();
/* /test_Fs_Stats */
