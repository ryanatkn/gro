import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {exists} from './fs.js';

test('file exists', async () => {
	assert.ok(await exists('./src/lib/fs.ts'));
});

test('file does not exist', async () => {
	assert.ok(!(await exists('./src/lib/existsssss.ts')));
});

test('directory exists', async () => {
	assert.ok(await exists('./src/lib'));
});

test('directory does not exist', async () => {
	assert.ok(!(await exists('./src/libbbbbbbb')));
});

test.run();
