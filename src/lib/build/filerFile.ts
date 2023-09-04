import type {Filesystem} from '../fs/filesystem.js';
import type {PathStats} from '../path/pathData.js';
import type {Encoding} from '../fs/encoding.js';
import {toHash} from './helpers.js';
import type {SourceFile} from './sourceFile.js';
import type {BuildFile} from './buildFile.js';
import type {BuildId, SourceId} from '../path/paths.js';

// TODO rename this module? or move this code elsewhere?

export type FilerFile = SourceFile | BuildFile;

export type FilerFileId = SourceId | BuildId;

export interface BaseFilerFile {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly encoding: Encoding;
	readonly content: string | Buffer;
	readonly type: string;
	contentBuffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	contentHash: string | undefined; // `undefined` and mutable for lazy loading
	stats: PathStats | undefined; // `undefined` and mutable for lazy loading
	mimeType: string | null | undefined; // `null` means unknown, `undefined` and mutable for lazy loading
}

export const getFileContentBuffer = (file: BaseFilerFile): Buffer =>
	file.contentBuffer !== undefined
		? file.contentBuffer
		: (file.contentBuffer = Buffer.from(file.content));

// PathStats are currently lazily loaded. Should they be?
export const getFileStats = (
	fs: Filesystem,
	file: BaseFilerFile,
): PathStats | Promise<PathStats> =>
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
