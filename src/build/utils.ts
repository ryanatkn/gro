import {createHash} from 'crypto';
import {resolve} from 'path';

import {paths} from '../paths.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const toHash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

export const createDirectoryFilter = (
	dir: string,
	rootDir = paths.source,
): ((id: string) => boolean) => {
	dir = resolve(rootDir, dir);
	const dirWithTrailingSlash = dir + '/';
	return (id) => id === dir || id.startsWith(dirWithTrailingSlash);
};
