import {describe, test, expect} from 'vitest';
import {webcrypto} from 'node:crypto';

import {to_hash} from './hash.ts';

describe('to_hash', () => {
	test('turns a buffer into a string', async () => {
		expect(typeof (await to_hash(Buffer.from('hey')))).toBe('string');
	});

	test('returns the same value given the same input', async () => {
		expect(await to_hash(Buffer.from('hey'))).toBe(await to_hash(Buffer.from('hey')));
	});

	test('checks against an implementation copied from MDN', async () => {
		const data = Buffer.from('some_test_string');
		expect(await to_hash_from_mdn_example(data)).toBe(await to_hash(data));
	});
});

/**
 * Copied from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 * and compared against our implementation for extra assurances, because cryptography.
 */
const to_hash_from_mdn_example = async (data: Buffer): Promise<string> =>
	Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', data)))
		.map((h) => h.toString(16).padStart(2, '0'))
		.join('');
