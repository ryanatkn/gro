import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {load_config} from './config.js';
import {fs} from '../fs/node.js';

test('load_config', async () => {
	const config = await load_config(fs);
	assert.ok(config);
});

test.run();
