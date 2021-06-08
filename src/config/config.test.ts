import {test} from 'uvu';
import * as t from 'uvu/assert';

import {load_config} from './config.js';
import {fs} from '../fs/node.js';

test('load_config', async () => {
	const config = await load_config(fs, true);
	t.ok(config);
});

test.run();
