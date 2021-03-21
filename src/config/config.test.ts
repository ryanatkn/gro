import {test} from 'uvu';
import * as t from 'uvu/assert';

import {loadGroConfig} from './config.js';

test('loadGroConfig', async () => {
	const config = await loadGroConfig();
	t.ok(config);
});

test.run();
