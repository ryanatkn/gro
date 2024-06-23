import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {existsSync} from 'node:fs';

test('file exists', async () => {
	assert.ok(existsSync('./src/lib/fs.ts'));
});

test('file does not exist', async () => {
	assert.ok(!existsSync('./src/lib/existsssss.ts'));
});

test('directory exists', async () => {
	assert.ok(existsSync('./src/lib'));
});

test('directory does not exist', async () => {
	assert.ok(!existsSync('./src/libbbbbbbb'));
});

test.run();
