import {describe, test, expect} from 'vitest';

import {to_hash} from '../lib/hash.ts';

describe('to_hash', () => {
	test('turns a Uint8Array into a string', async () => {
		expect(typeof (await to_hash(new TextEncoder().encode('hey')))).toBe('string');
	});

	test('returns the same value given the same input', async () => {
		const input = new TextEncoder().encode('hey');
		expect(await to_hash(input)).toBe(await to_hash(input));
	});

	test('checks against an implementation copied from MDN', async () => {
		const data = new TextEncoder().encode('some_test_string');
		expect(await to_hash_from_mdn_example(data)).toBe(await to_hash(data));
	});
});

/**
 * Copied from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 * and compared against our implementation for extra assurances, because cryptography.
 */
const to_hash_from_mdn_example = async (data: BufferSource): Promise<string> =>
	Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data)))
		.map((h) => h.toString(16).padStart(2, '0'))
		.join('');
