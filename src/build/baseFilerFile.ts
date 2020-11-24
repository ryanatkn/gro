import {createHash} from 'crypto';

import {stat, Stats} from '../fs/nodeFs.js';
import {Encoding} from '../fs/encoding.js';
import {getMimeTypeByExtension} from '../fs/mime.js';

// TODO rename this module? or move this code elsewhere?

export interface BaseFilerFile {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly encoding: Encoding;
	readonly contents: string | Buffer;
	contentsBuffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	contentsHash: string | undefined; // `undefined` and mutable for lazy loading
	stats: Stats | undefined; // `undefined` and mutable for lazy loading
	mimeType: string | null | undefined; // `null` means unknown, `undefined` and mutable for lazy loading
}

export const getFileMimeType = (file: BaseFilerFile): string | null =>
	file.mimeType !== undefined
		? file.mimeType
		: (file.mimeType = getMimeTypeByExtension(file.extension.substring(1)));

export const getFileContentsBuffer = (file: BaseFilerFile): Buffer =>
	file.contentsBuffer !== undefined
		? file.contentsBuffer
		: (file.contentsBuffer = Buffer.from(file.contents));

// Stats are currently lazily loaded. Should they be?
export const getFileStats = (file: BaseFilerFile): Stats | Promise<Stats> =>
	file.stats !== undefined
		? file.stats
		: stat(file.id).then((stats) => {
				file.stats = stats;
				return stats;
		  });

export const getFileContentsHash = (file: BaseFilerFile): string =>
	file.contentsHash !== undefined
		? file.contentsHash
		: (file.contentsHash = toHash(getFileContentsBuffer(file)));

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const toHash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');
