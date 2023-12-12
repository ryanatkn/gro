import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {update_changelog} from './changelog.js';

test('update_changelog', async () => {
	const result = await update_changelog();
	assert.ok(result);
});

test.run();
