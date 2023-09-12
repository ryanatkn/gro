import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {webcrypto} from 'node:crypto';

import {to_hash} from './hash.js';

/* test__to_hash */
const test__to_hash = suite('to_hash');

test__to_hash('turns a buffer into a string', async () => {
	assert.type(await to_hash(Buffer.from('hey')), 'string');
});

test__to_hash('returns the same value given the same input', async () => {
	assert.is(await to_hash(Buffer.from('hey')), await to_hash(Buffer.from('hey')));
});

test__to_hash('checks against an implementation copied from MDN', async () => {
	const data = Buffer.from('some_test_string');
	assert.is(await to_hash_from_mdn_example(data), await to_hash(data));
});

test__to_hash.run();
/* test__to_hash */

/**
 * Copied from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 * and compared against our implementation for extra assurances, because cryptography.
 */
const to_hash_from_mdn_example = async (data: Buffer): Promise<string> =>
	Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', data)))
		.map((h) => h.toString(16).padStart(2, '0'))
		.join('');
