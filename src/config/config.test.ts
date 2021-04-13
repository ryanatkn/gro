import {test} from 'uvu';
import * as t from 'uvu/assert';

import {loadGroConfig} from './config.js';
import {fs} from '../fs/node.js';

test('loadGroConfig', async () => {
	const config = await loadGroConfig(fs, true);
	t.ok(config);
});

test.run();
