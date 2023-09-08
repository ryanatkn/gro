import type {PathStats} from '../path/path_data.js';
import {to_hash} from './helpers.js';
import type {SourceFile} from './source_file.js';
import type {BuildFile} from './build_file.js';
import type {BuildId, SourceId} from '../path/paths.js';

// TODO rename this module? or move this code elsewhere?

export type FilerFile = SourceFile | BuildFile;

export type FilerFileId = SourceId | BuildId;

export interface BaseFilerFile {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly content: string;
	readonly type: string;
	content_buffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	content_hash: string | undefined; // `undefined` and mutable for lazy loading
	stats: PathStats | undefined; // `undefined` and mutable for lazy loading
}

export const get_file_content_buffer = (file: BaseFilerFile): Buffer =>
	file.content_buffer !== undefined
		? file.content_buffer
		: (file.content_buffer = Buffer.from(file.content));

export const get_file_content_hash = (file: BaseFilerFile): string =>
	file.content_hash !== undefined
		? file.content_hash
		: (file.content_hash = to_hash(get_file_content_buffer(file)));
