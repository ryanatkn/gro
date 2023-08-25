import type {Filesystem} from '../fs/filesystem.js';
import type {PathStats} from '../fs/pathData.js';
import type {Encoding} from '../fs/encoding.js';
import {getMimeTypeByExtension} from '../fs/mime.js';
import {toHash} from './helpers.js';

// TODO rename this module? or move this code elsewhere?

export interface BaseFilerFile {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly encoding: Encoding;
	readonly content: string | Buffer;
	contentBuffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	contentHash: string | undefined; // `undefined` and mutable for lazy loading
	stats: PathStats | undefined; // `undefined` and mutable for lazy loading
	mimeType: string | null | undefined; // `null` means unknown, `undefined` and mutable for lazy loading
}

export const getFileMimeType = (file: BaseFilerFile): string | null =>
	file.mimeType !== undefined
		? file.mimeType
		: (file.mimeType = getMimeTypeByExtension(file.extension.substring(1)));

export const getFileContentBuffer = (file: BaseFilerFile): Buffer =>
	file.contentBuffer !== undefined
		? file.contentBuffer
		: (file.contentBuffer = Buffer.from(file.content));

// PathStats are currently lazily loaded. Should they be?
export const getFileStats = (fs: Filesystem, file: BaseFilerFile): PathStats | Promise<PathStats> =>
	file.stats !== undefined
		? file.stats
		: fs.stat(file.id).then((stats) => {
				file.stats = stats;
				return stats;
		  });

export const getFileContentHash = (file: BaseFilerFile): string =>
	file.contentHash !== undefined
		? file.contentHash
		: (file.contentHash = toHash(getFileContentBuffer(file)));
