import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {load_config} from './config.js';

test('load_config', async () => {
	const config = await load_config();
	assert.ok(config);
});

test.run();
