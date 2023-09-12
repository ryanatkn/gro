import {createHash} from 'crypto';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const to_hash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');
