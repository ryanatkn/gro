import {test} from 'uvu';
import * as t from 'uvu/assert';

import {loadConfig} from './config.js';
import {fs} from '../fs/node.js';

test('loadConfig', async () => {
	const config = await loadConfig(fs, true);
	t.ok(config);
});

test.run();
