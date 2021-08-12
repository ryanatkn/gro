import type {Filesystem} from 'src/fs/filesystem.js';
import type {PathStats} from 'src/fs/path_data.js';
import type {Encoding} from 'src/fs/encoding.js';
import {get_mime_type_by_extension} from '../fs/mime.js';
import {to_hash} from './utils.js';

// TODO rename this module? or move this code elsewhere?

export interface BaseFilerFile {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly encoding: Encoding;
	readonly content: string | Buffer;
	content_buffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	content_hash: string | undefined; // `undefined` and mutable for lazy loading
	stats: PathStats | undefined; // `undefined` and mutable for lazy loading
	mime_type: string | null | undefined; // `null` means unknown, `undefined` and mutable for lazy loading
}

export const get_file_mime_type = (file: BaseFilerFile): string | null =>
	file.mime_type !== undefined
		? file.mime_type
		: (file.mime_type = get_mime_type_by_extension(file.extension.substring(1)));

export const get_file_content_buffer = (file: BaseFilerFile): Buffer =>
	file.content_buffer !== undefined
		? file.content_buffer
		: (file.content_buffer = Buffer.from(file.content));

// PathStats are currently lazily loaded. Should they be?
export const get_file_stats = (
	fs: Filesystem,
	file: BaseFilerFile,
): PathStats | Promise<PathStats> =>
	file.stats !== undefined
		? file.stats
		: fs.stat(file.id).then((stats) => {
				file.stats = stats;
				return stats;
		  });

export const get_file_content_hash = (file: BaseFilerFile): string =>
	file.content_hash !== undefined
		? file.content_hash
		: (file.content_hash = to_hash(get_file_content_buffer(file)));
