import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {loadConfig} from './config.js';
import {fs} from '../fs/node.js';

test('loadConfig', async () => {
	const config = await loadConfig(fs);
	assert.ok(config);
});

test.run();
