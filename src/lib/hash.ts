const {subtle} = globalThis.crypto;

const encoder = new TextEncoder();

/**
 * Computes a cryptographic hash of the given data.
 *
 * @param data - String or binary data to hash. Strings are UTF-8 encoded internally.
 * @param algorithm - Hash algorithm to use. Defaults to SHA-256.
 * @returns Hexadecimal hash string.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
 */
export const to_hash = async (
	data: BufferSource | string,
	algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256',
): Promise<string> => {
	const buffer = typeof data === 'string' ? encoder.encode(data) : data;
	const digested = await subtle.digest(algorithm, buffer);
	const bytes = Array.from(new Uint8Array(digested));
	let hex = '';
	for (const h of bytes) {
		hex += h.toString(16).padStart(2, '0');
	}
	return hex;
};
