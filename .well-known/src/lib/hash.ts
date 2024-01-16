import {webcrypto} from 'node:crypto';

const {subtle} = webcrypto;

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
 */
export const to_hash = async (
	data: Buffer,
	algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256',
): Promise<string> => {
	const digested = await subtle.digest(algorithm, data);
	const bytes = Array.from(new Uint8Array(digested));
	let hex = '';
	for (const h of bytes) {
		hex += h.toString(16).padStart(2, '0');
	}
	return hex;
};
